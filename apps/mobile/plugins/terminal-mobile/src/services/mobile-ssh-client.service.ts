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
import { createIdentifier, Disposable } from '@termlnk/core';
import { RnRussh } from '@termlnk/react-native-russh';
import { BehaviorSubject, Subject } from 'rxjs';
import { evaluateServerKey } from './server-key-tofu';

export type SshConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface IMobileSshConnectOptions {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password?: string;
  readonly privateKey?: string;
  readonly hostId?: string; // optional — when provided drives the TOFU store
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
  readonly state: SshConnectionState;
  readonly state$: Observable<SshConnectionState>;
  readonly shellOutput$: Observable<string>;

  exec: (command: string) => Promise<string>;
  startShell: (opts?: IShellStartOptions) => Promise<void>;
  writeToShell: (data: string) => Promise<void>;
  closeShell: () => void;
  disconnect: () => void;
  openSftp: () => Promise<ISftpSession>;
}

const utf8Decoder = new TextDecoder('utf-8');
const utf8Encoder = new TextEncoder();

class MobileSshSession extends Disposable implements IMobileSshSession {
  private readonly _state$ = new BehaviorSubject<SshConnectionState>('connected');
  readonly state$: Observable<SshConnectionState> = this._state$.asObservable();

  private readonly _shellOutput$ = new Subject<string>();
  readonly shellOutput$: Observable<string> = this._shellOutput$.asObservable();

  private _shell: ISshShell | null = null;
  private _listenerId: bigint | null = null;

  constructor(
    readonly host: string,
    private readonly _connection: ISshConnection
  ) {
    super();
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
      this._shellOutput$.next(`\r\n[termlnk] dropped seq ${ev.fromSeq}..${ev.toSeq}\r\n`);
      return;
    }
    const chunk = ev as ITerminalChunk;
    this._shellOutput$.next(utf8Decoder.decode(new Uint8Array(chunk.bytes), { stream: true }));
  };
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
          // No TOFU store key — accept once. Callers should pass hostId so
          // the store is keyed correctly; we don't want to refuse based on
          // a stale empty store either.
          return true;
        }
        const decision = await evaluateServerKey(
          options.hostId,
          info.algorithm,
          info.fingerprintSha256
        );
        if (decision.kind === 'mismatch') {
          throw new Error(
            `Host key for ${info.host}:${info.port} changed since first use. ` +
              `Stored ${decision.stored.algorithm} ${decision.stored.fingerprintSha256}; ` +
              `presented ${decision.presented.algorithm} ${decision.presented.fingerprintSha256}.`
          );
        }
        return true;
      },
    });
    return new MobileSshSession(options.host, connection);
  }
}
