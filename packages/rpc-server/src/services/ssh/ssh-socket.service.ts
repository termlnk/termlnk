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
import type { ConnectConfig } from 'ssh2';
import type { ISSHSocket } from './ssh-socket';
import * as process from 'node:process';
import { createIdentifier, Disposable, ILogService } from '@termlnk/core';
import { DEFAULT_SSH_CONNECTION_HEARTBEAT, DEFAULT_SSH_CONNECTION_TIMEOUT } from '../../config/config';
import { IProxySocketService } from '../proxy/proxy-socket.service';
import { createSSHSocket } from './ssh-socket';

export interface ISSHSocketService {
  createSocket(key: string): ISSHSocket;
  releaseSocket(key: string): void;
  createConnectConfig(host: IHost, overrides?: { password?: string }): Promise<ConnectConfig>;
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
    @IProxySocketService private readonly _proxySocketService: IProxySocketService
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

  async createConnectConfig(host: IHost, overrides: { password?: string } = {}): Promise<ConnectConfig> {
    const { credential, addr, port, proxy } = host;
    const address = normalizeHostAddress(addr);
    const sshPort = port || 22;

    const config: ConnectConfig = {
      host: address,
      port: sshPort,
      username: credential.username,
      readyTimeout: host.settings?.connectTimeout || DEFAULT_SSH_CONNECTION_TIMEOUT,
      keepaliveInterval: host.settings?.connectHeartbeat || DEFAULT_SSH_CONNECTION_HEARTBEAT,
      keepaliveCountMax: 3,
      tryKeyboard: true,
    };

    if (credential.type === 'password') {
      config.password = overrides?.password || credential.password;
    } else if (credential.type === 'rsa') {
      config.privateKey = normalizePrivateKey(credential.privateKey);
    } else if (credential.type === 'always') {
      if (process.env.SSH_AUTH_SOCK) {
        config.agent = process.env.SSH_AUTH_SOCK;
      }
    }

    if (proxy?.enabled) {
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

  getMultiplexerKey(profile: IHost): string {
    const p = profile.proxy;
    return [
      profile.addr,
      profile.port,
      profile.credential.username,
      p?.enabled ? '1' : '0',
      p?.host ?? '',
      p?.port ?? '',
    ].join(':');
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
