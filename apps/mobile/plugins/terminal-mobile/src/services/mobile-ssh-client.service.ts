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

import type { ISftpSession, ISshConnection, ISshShell, ITerminalChunk, ShellListenerEvent } from '@termlnk/react-native-russh';
import type { Observable } from 'rxjs';
import type { MobileSshSessionEvent } from './mobile-ssh-session-event';
import { createIdentifier, Disposable } from '@termlnk/core';
import { RnRussh } from '@termlnk/react-native-russh';
import { BehaviorSubject, Subject } from 'rxjs';
import { evaluateServerKey, forgetServerKey, recordServerKey } from './server-key-tofu';

export type SshConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface IMobileSshConnectOptions {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly privateKey?: string;
  readonly hostId?: string; // optional — when provided drives the TOFU store
  readonly onInteraction?: (event: MobileSshSessionEvent) => void;
}

export interface IShellStartOptions {
  // One-shot PTY size. The russh wrapper has no window-change yet, so this
  // value must be measured before startShell() — otherwise the remote falls
  // back to ~80x24 and wraps lines on phone-shaped WebViews.
  readonly terminalSize?: {
    readonly cols: number;
    readonly rows: number;
  };
}

export interface IMobileSshSession {
  readonly host: string;
  readonly connection: ISshConnection;
  readonly state: SshConnectionState;
  readonly state$: Observable<SshConnectionState>;
  readonly shellOutput$: Observable<string>;
  readonly shellTranscript: string;

  exec: (command: string) => Promise<string>;
  startShell: (opts?: IShellStartOptions) => Promise<void>;
  writeToShell: (data: string) => Promise<void>;
  closeShell: () => void;
  disconnect: () => void;
  openSftp: () => Promise<ISftpSession>;
}

const utf8Decoder = new TextDecoder('utf-8');
const utf8Encoder = new TextEncoder();
const MAX_TRANSCRIPT_CHARS = 200_000;

class MobileSshSession extends Disposable implements IMobileSshSession {
  private readonly _state$ = new BehaviorSubject<SshConnectionState>('connected');
  readonly state$: Observable<SshConnectionState> = this._state$.asObservable();

  private readonly _shellOutput$ = new Subject<string>();
  readonly shellOutput$: Observable<string> = this._shellOutput$.asObservable();

  private _shellTranscript = '';

  private _shell: ISshShell | null = null;
  private _listenerId: bigint | null = null;

  constructor(
    readonly host: string,
    private readonly _connection: ISshConnection
  ) {
    super();
  }

  get connection(): ISshConnection {
    return this._connection;
  }

  override dispose(): void {
    this.disconnect();
    this._state$.complete();
    this._shellOutput$.complete();
    super.dispose();
  }

  get state(): SshConnectionState {
    return this._state$.getValue();
  }

  get shellTranscript(): string {
    return this._shellTranscript;
  }

  async exec(_command: string): Promise<string> {
    throw new Error(
      'MobileSshSession.exec() is not supported by the russh backend — use startShell() + writeToShell() and parse the output stream.'
    );
  }

  async startShell(opts?: IShellStartOptions): Promise<void> {
    if (this._shell) {
      return;
    }
    const shell = await this._connection.startShell({
      term: 'Xterm256',
      terminalSize: opts?.terminalSize
        ? { colWidth: opts.terminalSize.cols, rowHeight: opts.terminalSize.rows }
        : undefined,
      onClosed: () => {
        this._shell = null;
        this._listenerId = null;
      },
    });
    this._shell = shell;
    this._listenerId = shell.addListener(this._onShellEvent, { cursor: { mode: 'live' } });
  }

  async writeToShell(data: string): Promise<void> {
    const shell = this._requireShell();
    const bytes = utf8Encoder.encode(data);
    // Copy the underlying buffer so the FFI layer doesn't see a view shared
    // with another writer — the russh bridge takes ownership.
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await shell.sendData(buf);
  }

  closeShell(): void {
    if (!this._shell) {
      return;
    }
    if (this._listenerId !== null) {
      try {
        this._shell.removeListener(this._listenerId);
      } catch {
        // Best-effort — listener may have died with the channel.
      }
      this._listenerId = null;
    }
    void this._shell.close().catch(() => {
      // Closing an already-dead channel is fine.
    });
    this._shell = null;
  }

  disconnect(): void {
    this.closeShell();
    if (this.state === 'disconnected') {
      return;
    }
    void this._connection.disconnect().catch(() => {
      // Transport is already torn down on the network side; swallow.
    });
    this._state$.next('disconnected');
  }

  async openSftp(): Promise<ISftpSession> {
    return this._connection.startSftp();
  }

  private _requireShell(): ISshShell {
    if (!this._shell) {
      throw new Error('Shell has not been started yet — call startShell() first.');
    }
    return this._shell;
  }

  private readonly _onShellEvent = (ev: ShellListenerEvent): void => {
    if ('kind' in ev) {
      // Dropped notice — surface as control message in the output stream so
      // the UI can render a "lost N..M bytes" banner if it wants. v1 just
      // forwards the seq range as text.
      this._emitShellOutput(`\r\n[termlnk] dropped seq ${ev.fromSeq}..${ev.toSeq}\r\n`);
      return;
    }
    const chunk = ev as ITerminalChunk;
    this._emitShellOutput(utf8Decoder.decode(new Uint8Array(chunk.bytes), { stream: true }));
  };

  private _emitShellOutput(output: string): void {
    this._shellTranscript += output;
    if (this._shellTranscript.length > MAX_TRANSCRIPT_CHARS) {
      this._shellTranscript = this._shellTranscript.slice(-MAX_TRANSCRIPT_CHARS);
    }
    this._shellOutput$.next(output);
  }
}

export interface IMobileSshClientService {
  connect(options: IMobileSshConnectOptions): Promise<IMobileSshSession>;
}

export const IMobileSshClientService = createIdentifier<IMobileSshClientService>('mobile.ssh-client.service');

export class MobileSshClientService extends Disposable implements IMobileSshClientService {
  async connect(options: IMobileSshConnectOptions): Promise<IMobileSshSession> {
    await RnRussh.uniffiInitAsync();

    if (!options.password && !options.privateKey) {
      throw new Error('Either password or privateKey is required');
    }

    const connection = await RnRussh.connect({
      host: options.host,
      port: options.port,
      username: options.username,
      security: options.privateKey
        ? { type: 'key', privateKey: options.privateKey }
        : { type: 'password', password: options.password! },
      onServerKey: async (info) => {
        if (!options.hostId) {
          return true;
        }
        const interactive = !!options.onInteraction;
        const decision = await evaluateServerKey(
          options.hostId,
          info.algorithm,
          info.fingerprintSha256,
          interactive ? { saveOnFirstUse: false } : undefined
        );
        if (decision.kind === 'trusted') {
          return true;
        }
        if (decision.kind === 'first-use') {
          if (!interactive) {
            return true;
          }
          return new Promise<boolean>((resolve) => {
            options.onInteraction!({
              type: 'host_key_first_use',
              hostId: options.hostId!,
              host: info.host,
              port: info.port,
              algorithm: info.algorithm,
              fingerprintSha256: info.fingerprintSha256,
              respond: (accept) => {
                if (accept) {
                  void recordServerKey(options.hostId!, info.algorithm, info.fingerprintSha256);
                }
                resolve(accept);
              },
            });
          });
        }
        if (decision.kind === 'mismatch') {
          if (!interactive) {
            throw new Error(
              `Host key for ${info.host}:${info.port} changed since first use. ` +
                `Stored ${decision.stored.algorithm} ${decision.stored.fingerprintSha256}; ` +
                `presented ${decision.presented.algorithm} ${decision.presented.fingerprintSha256}.`
            );
          }
          return new Promise<boolean>((resolve) => {
            options.onInteraction!({
              type: 'host_key_mismatch',
              hostId: options.hostId!,
              host: info.host,
              port: info.port,
              algorithm: info.algorithm,
              fingerprintSha256: info.fingerprintSha256,
              storedAlgorithm: decision.stored.algorithm,
              storedFingerprint: decision.stored.fingerprintSha256,
              respond: (replaceAndContinue) => {
                if (replaceAndContinue) {
                  void forgetServerKey(options.hostId!).then(() =>
                    recordServerKey(options.hostId!, info.algorithm, info.fingerprintSha256)
                  );
                }
                resolve(replaceAndContinue);
              },
            });
          });
        }
        return true;
      },
    });
    return new MobileSshSession(options.host, connection);
  }
}
