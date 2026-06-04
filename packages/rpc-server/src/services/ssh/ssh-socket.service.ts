/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { IHost } from '@termlnk/terminal';
import type { Buffer } from 'node:buffer';
import type { Duplex } from 'node:stream';
import type { ConnectConfig } from 'ssh2';
import type { ISSHSocket } from './ssh-socket';
import * as process from 'node:process';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { IdentityRepository, KnownHostRepository, SshKeyRepository } from '@termlnk/database';
import { DEFAULT_SSH_CONNECTION_HEARTBEAT, DEFAULT_SSH_CONNECTION_TIMEOUT } from '../../config/config';
import { IProxySocketService } from '../proxy/proxy-socket.service';
import { hostKeyAlgorithm, sha256Fingerprint } from './host-key-fingerprint';
import { resolveHostCredential } from './resolve-host-credential';
import { createSSHSocket } from './ssh-socket';

export type HostKeyVerifyAction = 'accept_save' | 'accept_once' | 'reject';

export interface IHostKeyPromptInfo {
  algorithm: string;
  fingerprint: string;
  changed: boolean;
  knownFingerprint?: string;
}

export interface ISSHConnectConfigOverrides {
  password?: string;
  /**
   * Pre-established host-chain TCP tunnel. When provided, the target host's
   * ssh2 handshake runs over this stream (injected into ConnectConfig.sock)
   * instead of opening a direct TCP socket. The chain entry already handled
   * any proxy, so the target host's `proxy` field is ignored in this case.
   */
  chainTunnel?: Duplex;
  /**
   * Interactive host-key decision for unknown/changed keys. Provided by the SSH
   * session so the renderer can prompt. When absent (SFTP, chain hops) the verifier
   * falls back to TOFU for unknown keys and rejects changed keys.
   */
  onHostKeyPrompt?: (info: IHostKeyPromptInfo) => Promise<HostKeyVerifyAction>;
}

export interface ISSHSocketService {
  createSocket(key: string): ISSHSocket;
  releaseSocket(key: string): void;
  createConnectConfig(host: IHost, overrides?: ISSHConnectConfigOverrides): Promise<ConnectConfig>;
  getMultiplexerKey(profile: IHost): string;
}
export const ISSHSocketService = createIdentifier<ISSHSocketService>('rpc-server.ssh-socket-service');

interface ISocketEntry {
  socket: ISSHSocket;
  refCount: number;
}

export class SSHSocketService extends Disposable implements ISSHSocketService {
  private readonly _sockets = new Map<string, ISocketEntry>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IProxySocketService private readonly _proxySocketService: IProxySocketService,
    @Inject(SshKeyRepository) private readonly _sshKeyRepository: SshKeyRepository,
    @Inject(IdentityRepository) private readonly _identityRepository: IdentityRepository,
    @Inject(KnownHostRepository) private readonly _knownHostRepository: KnownHostRepository
  ) {
    super();
  }

  override dispose() {
    super.dispose();
    this._sockets.forEach((entry) => {
      entry.socket.destroy();
      entry.socket.dispose();
    });
    this._sockets.clear();
  }

  createSocket(key: string): ISSHSocket {
    const entry = this._ensureSocketEntry(key);
    entry.refCount++;
    return entry.socket;
  }

  releaseSocket(key: string): void {
    const entry = this._sockets.get(key);
    if (!entry) {
      return;
    }

    entry.refCount--;
    if (entry.refCount > 0) {
      return;
    }

    entry.socket.destroy();
    this._sockets.delete(key);
  }

  private _ensureSocketEntry(key: string): ISocketEntry {
    let entry = this._sockets.get(key);
    if (!entry) {
      const socket = createSSHSocket(key);
      entry = { socket, refCount: 0 };
      this._sockets.set(key, entry);

      socket.close$.subscribe(() => {
        this._sockets.delete(key);
      });
    }
    return entry;
  }

  async createConnectConfig(host: IHost, overrides: ISSHConnectConfigOverrides = {}): Promise<ConnectConfig> {
    const { addr, port, proxy } = host;
    const address = normalizeHostAddress(addr);
    const sshPort = port || 22;

    // Resolve keychain references (key / identity) into an inline credential the ssh2 client
    // can consume. Legacy password / rsa / always credentials pass through unchanged.
    const { credential, passphrase } = await resolveHostCredential(host.credential, {
      sshKeyRepo: this._sshKeyRepository,
      identityRepo: this._identityRepository,
    });

    const config: ConnectConfig = {
      host: address,
      port: sshPort,
      username: credential.username,
      readyTimeout: host.settings?.connectTimeout || DEFAULT_SSH_CONNECTION_TIMEOUT,
      keepaliveInterval: host.settings?.connectHeartbeat || DEFAULT_SSH_CONNECTION_HEARTBEAT,
      keepaliveCountMax: 3,
      tryKeyboard: true,
      hostVerifier: (keyDER: Buffer, verify: (valid: boolean) => void) => {
        void this._verifyHostKey(address, sshPort, keyDER, overrides.onHostKeyPrompt).then(verify);
      },
    };

    if (credential.type === 'password') {
      config.password = overrides?.password || credential.password;
    } else if (credential.type === 'rsa') {
      config.privateKey = normalizePrivateKey(credential.privateKey);
      if (passphrase) {
        config.passphrase = passphrase;
      }
    } else if (credential.type === 'always') {
      if (process.env.SSH_AUTH_SOCK) {
        config.agent = process.env.SSH_AUTH_SOCK;
      }
    }

    // Chain tunnel takes precedence over proxy: the chain entry already
    // handled any proxy traversal, so the target host's proxy is irrelevant.
    if (overrides.chainTunnel) {
      config.sock = overrides.chainTunnel;
      delete config.host;
      delete config.port;
    } else if (proxy?.enabled) {
      const proxySocket = this._proxySocketService.createSocket(host.id);
      const tunnelSocket = await proxySocket.connect({
        proxy,
        destination: { host: address, port: sshPort },
        timeout: config.readyTimeout,
      });

      config.sock = tunnelSocket;
      delete config.host;
      delete config.port;
    }

    return config;
  }

  // Owns host-key classification and known-hosts persistence. Returns whether to accept the
  // key: trusted keys pass silently; unknown/changed defer to the interactive prompt when one
  // is supplied (SSH sessions), otherwise TOFU-record unknown keys and reject changed ones
  // (SFTP, chain hops). Fails closed on any error.
  private async _verifyHostKey(
    host: string,
    port: number,
    keyDER: Buffer,
    onPrompt?: (info: IHostKeyPromptInfo) => Promise<HostKeyVerifyAction>
  ): Promise<boolean> {
    const algorithm = hostKeyAlgorithm(keyDER);
    const fingerprint = sha256Fingerprint(keyDER);
    try {
      const match = await this._knownHostRepository.classify(host, port, algorithm, fingerprint);
      if (match.verdict === 'trusted') {
        void this._knownHostRepository.touchLastSeen(host, port, fingerprint);
        return true;
      }
      const publicKey = keyDER.toString('base64');
      if (onPrompt) {
        const action = await onPrompt({ algorithm, fingerprint, changed: match.verdict === 'changed', knownFingerprint: match.existing?.fingerprint });
        if (action === 'reject') {
          return false;
        }
        if (action === 'accept_save') {
          await this._knownHostRepository.upsert({ host, port, keyType: algorithm, fingerprint, publicKey });
        }
        return true;
      }
      if (match.verdict === 'unknown') {
        await this._knownHostRepository.upsert({ host, port, keyType: algorithm, fingerprint, publicKey });
        return true;
      }
      return false;
    } catch (error) {
      this._logService.error('[SSHSocketService] Host key verification failed; rejecting', error);
      return false;
    }
  }

  getMultiplexerKey(profile: IHost): string {
    const p = profile.proxy;
    const chain = profile.hostChainIds?.length ? `|C:${profile.hostChainIds.join('>')}` : '';
    // Distinct credentials must not share a multiplexed socket. Keychain references key off
    // their referenced id (plus the per-host passphrase override); inline credentials off the
    // username.
    const credential = profile.credential;
    const credentialToken = credential.type === 'identity'
      ? `I:${credential.identityId}`
      : credential.type === 'key'
        ? `K:${credential.keyId}:${credential.username}:${credential.passphrase ?? ''}`
        : credential.username;
    return [
      profile.addr,
      profile.port,
      credentialToken,
      p?.enabled ? '1' : '0',
      p?.host ?? '',
      p?.port ?? '',
    ].join(':') + chain;
  }
}

function normalizeHostAddress(value: string): string {
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizePrivateKey(value: string): string {
  if (!value) return value;
  let normalized = value.replace(/\r\n/g, '\n');
  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }
  return normalized;
}
