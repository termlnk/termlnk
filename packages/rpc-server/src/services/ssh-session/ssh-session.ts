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

import type { IDisposable, Nullable } from '@termlnk/core';
import type { SSHSessionEvent } from '@termlnk/rpc';
import type { IHost } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import type { ChangePasswordCallback, KeyboardInteractiveCallback } from 'ssh2';
import type { ITerminalMiddlewareStack } from '../middleware/terminal-middleware-stack';
import type { ISSHChannel } from '../ssh/ssh-channel';
import type { IHostChainHandle } from '../ssh/ssh-host-chain.service';
import type { ISSHSocket } from '../ssh/ssh-socket';
import * as process from 'node:process';
import { Disposable, DisposableCollection, ILogService, takeAfter, toDisposable } from '@termlnk/core';
import { SSHSessionStatus, SSHSocketStatus } from '@termlnk/rpc';
import { BehaviorSubject, merge, of, ReplaySubject, skip, Subject } from 'rxjs';
import { createTerminalMiddlewareStack } from '../middleware/terminal-middleware-stack';
import { ISSHSocketService } from '../ssh/ssh-socket.service';
import { bridgeX11Channel, connectToXServer, parseDisplay } from './x11-forward';

export class SSHSession extends Disposable implements IDisposable {
  private readonly _status$ = new BehaviorSubject<SSHSessionStatus>(SSHSessionStatus.IDLE);
  readonly status$ = this._status$.asObservable();
  get status(): SSHSessionStatus {
    return this._status$.getValue();
  }

  private readonly _event$ = new ReplaySubject<SSHSessionEvent>(50);
  readonly event$ = this._event$.asObservable();

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$ = this._connected$.asObservable();
  get isConnected(): boolean {
    return this._connected$.getValue();
  }

  private readonly _data$ = new Subject<Uint8Array>();
  readonly data$ = this._data$.asObservable();

  private readonly _error$ = new Subject<string>();
  readonly error$ = this._error$.asObservable();

  get host(): IHost {
    return this._host;
  }

  private _closeReason: 'auth_failed' | 'error' | undefined;

  private _channel: Nullable<ISSHChannel>;
  private readonly _middlewareStack = createTerminalMiddlewareStack();
  private _socketDisposables = new DisposableCollection();
  private _x11Disposables = new DisposableCollection();
  private _chainDisposables = new DisposableCollection();
  private _pendingKeyboardInteractiveFinish: Nullable<KeyboardInteractiveCallback> = null;
  private _pendingChangePasswordDone: Nullable<ChangePasswordCallback> = null;
  private _hostChain: Nullable<IHostChainHandle> = null;

  constructor(
    private readonly _sessionId: string,
    private _socket: ISSHSocket,
    private readonly _host: IHost,
    private _cols: number = 80,
    private _rows: number = 24,
    private _password: Nullable<string>,
    /**
     * Optional remote command to execute instead of opening a plain shell.
     * When non-null, the session opens an `exec` channel with a PTY allocated
     * and runs this command — used by shell-integration bootstrap (provisions
     * hooks on disk then execs the user's interactive shell). When null, the
     * session opens a regular interactive shell channel (legacy path).
     */
    private readonly _bootstrapCommand: Nullable<string>,
    @ISSHSocketService private readonly _sshSocketService: ISSHSocketService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._ensureSocketStatusEvent();
    this._ensureInteractiveEvents();
    this._init();
    this.log('Session initialized.');
  }

  /**
   * Attach a host chain handle. The session takes ownership and disposes it
   * on close. Must be called before `socket.connect` so hop events flow from
   * `chain.hopEvent$` into `session.event$`. Status advances to CONNECTING
   * immediately so subscribers see progress before the target socket connects.
   */
  attachHostChain(chain: IHostChainHandle): void {
    if (this._hostChain) {
      this._chainDisposables.dispose();
      this._hostChain.dispose();
    }
    this._hostChain = chain;
    this._chainDisposables = new DisposableCollection();
    this._chainDisposables.add(toDisposable(chain.hopEvent$.subscribe((hopEvent) => {
      this._event$.next(hopEvent.event);
    })));
    this._chainDisposables.add(toDisposable(chain.progress$.subscribe(({ hopId, hopLabel, hopIndex, hopCount, status, message }) => {
      this._event$.next({ type: 'hop_progress', hopId, hopLabel, hopIndex, hopCount, status, message });
    })));
    this._setStatus(SSHSessionStatus.CONNECTING);
  }

  /** Surface a failed chain build as a session-level error. */
  markChainFailed(err: Error): void {
    const message = formatSocketError(err as Error & { code?: string; level?: string });
    this._error$.next(message);
    this._setStatus(SSHSessionStatus.ERROR);
    this.log(`Host chain failed: ${message}`);
  }

  private _init() {
    if (this._socket.status === SSHSocketStatus.READY) {
      this._ensureChannel();
    }
    this._socketDisposables.add(toDisposable(this._socket.ready$.subscribe(async () => {
      this._ensureChannel();
    })));
    this._ensureSocketDiagnostics();
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get hostId(): string {
    return this._host.id;
  }

  get label(): string {
    return this._host.label;
  }

  get socketId(): string {
    return this._socket.id;
  }

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  get closeReason(): 'auth_failed' | 'error' | undefined {
    return this._closeReason;
  }

  get middlewareStack(): ITerminalMiddlewareStack {
    return this._middlewareStack;
  }

  rawWrite(data: Uint8Array): void {
    this._channel?.write(data);
  }

  pushData(data: Uint8Array): void {
    this._data$.next(data);
  }

  async write(data: string | Uint8Array): Promise<void> {
    if (!this._channel) {
      return;
    }
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const processed = this._middlewareStack.processFromTerminal(buf);
    if (processed !== null) {
      this._channel.write(processed);
    }
  }

  async resize(rows: number, cols: number): Promise<void> {
    this._cols = cols;
    this._rows = rows;

    if (!this._channel) {
      return;
    }

    this._channel.setWindow(rows, cols, 0, 0);
  }

  async close(): Promise<void> {
    if (!this._channel) {
      return;
    }

    this._channel.close();
  }

  log(message: string): void {
    this._event$.next({ type: 'log', message });
    this._logService.log(`[SSHSession] ${this._sessionId}`, message);
  }

  respondKeyboardInteractive(responses: string[], viaHopId?: string): void {
    if (viaHopId) {
      this._hostChain?.respondKeyboardInteractive(viaHopId, responses);
      return;
    }
    this._pendingKeyboardInteractiveFinish?.(responses);
    this._pendingKeyboardInteractiveFinish = null;
  }

  respondChangePassword(newPassword: string, viaHopId?: string): void {
    if (viaHopId) {
      this._hostChain?.respondChangePassword(viaHopId, newPassword);
      return;
    }
    this._pendingChangePasswordDone?.(newPassword);
    this._pendingChangePasswordDone = null;
  }

  setPassword(password?: string): void {
    this._password = password ?? null;
  }

  rebindSocket(socket: ISSHSocket): void {
    this._socketDisposables.dispose();
    this._socketDisposables = new DisposableCollection();
    this._x11Disposables.dispose();
    this._x11Disposables = new DisposableCollection();
    this._socket = socket;
    this._channel = null;
    this._ensureSocketStatusEvent();
    this._ensureInteractiveEvents();
    this._init();
  }

  private _setStatus(status: SSHSessionStatus): void {
    switch (status) {
      case SSHSessionStatus.AUTH_FAILED:
        this._closeReason = 'auth_failed';
        break;
      case SSHSessionStatus.ERROR:
        this._closeReason = 'error';
        break;
      case SSHSessionStatus.CLOSED:
        // Preserve existing reason — CLOSED follows AUTH_FAILED/ERROR
        break;
      default:
        this._closeReason = undefined;
        break;
    }
    this._status$.next(status);
  }

  private async _ensureChannel() {
    if (this._channel) {
      return;
    }

    const x11Enabled = this._host?.settings?.x11Forward;
    const requestedRows = this._rows;
    const requestedCols = this._cols;
    const ptyOptions = {
      rows: requestedRows,
      cols: requestedCols,
      term: this._host?.settings?.termType || 'xterm-256color',
    };

    if (x11Enabled) {
      this._setupX11Forwarding();
    }

    if (this._bootstrapCommand) {
      this._channel = await this._socket.exec(
        this._bootstrapCommand,
        x11Enabled ? { pty: ptyOptions, x11: true } : { pty: ptyOptions }
      );
    } else {
      this._channel = x11Enabled
        ? await this._socket.shell(ptyOptions, { x11: true })
        : await this._socket.shell(ptyOptions);
    }

    // resize() may update dimensions during await shell() — apply pending changes
    if (this._rows !== requestedRows || this._cols !== requestedCols) {
      this._channel.setWindow(this._rows, this._cols, 0, 0);
    }

    this._channel.data$.subscribe((data) => {
      const processed = this._middlewareStack.processFromSession(data);
      if (processed !== null) {
        this._data$.next(processed);
      }
    });
    this._channel.error$.subscribe((err) => {
      this._error$.next(new TextDecoder().decode(err));
      this._setStatus(SSHSessionStatus.ERROR);
    });

    this._channel.close$.subscribe(() => {
      this._channel = null;
      this._x11Disposables.dispose();
      this._setStatus(SSHSessionStatus.CLOSED);
      this._connected$.next(false);
      // Release socket reference when session closes
      this._sshSocketService.releaseSocket(this._socket.id);
    });

    this._connected$.next(true);
    this._setStatus(SSHSessionStatus.READY);

    this._executeRunScript();
  }

  private _setupX11Forwarding(): void {
    this._x11Disposables.add(toDisposable(this._socket.x11$.subscribe(({ accept, reject }) => {
      const target = parseDisplay(process.env.DISPLAY);
      if (!target) {
        this._logService.warn('[SSHSession] X11 forwarding: cannot parse DISPLAY, rejecting channel');
        reject();
        return;
      }

      const xServerSocket = connectToXServer(target);

      xServerSocket.on('connect', () => {
        const x11Channel = accept();
        const cleanup = bridgeX11Channel(x11Channel, xServerSocket, (err) => {
          this._logService.warn('[SSHSession] X11 bridge error', err);
        });
        this._x11Disposables.add(toDisposable(cleanup));
      });

      xServerSocket.on('error', (err) => {
        this._logService.warn('[SSHSession] X11 forwarding: failed to connect to X server', err);
        reject();
      });
    })));
  }

  private _executeRunScript(): void {
    const runScript = this._host?.settings?.runScript;
    if (!runScript || !this._channel) return;

    const lines = runScript.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) return;

    // Delay to let the remote shell initialize before sending commands
    setTimeout(() => {
      for (const line of lines) {
        this._channel?.write(`${line}\r`);
      }
    }, 500);
  }

  private _ensureSocketStatusEvent() {
    const socketStatus$ = this._socket.status$.pipe(skip(1));
    const status$ = merge(
      getStatusAndBefore(this._socket.status),
      socketStatus$
    ).pipe(takeAfter((e) => e === SSHSocketStatus.CLOSED));

    this._socketDisposables.add(toDisposable(status$.subscribe((status) => {
      this._setStatus(mapSocketStatusToSessionStatus(status));
    })));

    this._socketDisposables.add(toDisposable(this._socket.error$.subscribe(({ err }) => {
      if (!err) return;
      const message = formatSocketError(err);
      const isAuthError = (err as any).level === 'client-authentication';
      if (isAuthError) {
        this._setStatus(SSHSessionStatus.AUTH_FAILED);
        this._error$.next(message);
        this._event$.next({ type: 'auth_failed', message });
      } else {
        this._error$.next(message);
        this._setStatus(SSHSessionStatus.ERROR);
      }
      this._logService.error('[SSHSession] Socket error', err);
    })));
  }

  private _ensureSocketDiagnostics() {
    this._socketDisposables.add(toDisposable(this._socket.connect$.subscribe(() => {
      this.log('TCP connected.');
    })));

    this._socketDisposables.add(toDisposable(this._socket.greeting$.subscribe((greeting) => {
      this.log(`Greeting: ${greeting}`);
    })));

    this._socketDisposables.add(toDisposable(this._socket.handshake$.subscribe(({ negotiated }) => {
      const hostKey = negotiated?.serverHostKey ? `, hostKey=${negotiated.serverHostKey}` : '';
      this.log(`Handshake completed${hostKey}.`);
    })));

    this._socketDisposables.add(toDisposable(this._socket.ready$.subscribe(() => {
      this.log('Authentication successful. Opening shell...');
    })));

    this._socketDisposables.add(toDisposable(this._socket.timeout$.subscribe(() => {
      const message = 'Connection timeout.';
      this._error$.next(message);
      this._setStatus(SSHSessionStatus.ERROR);
      this.log(message);
      this._socket.destroy();
    })));

    this._socketDisposables.add(toDisposable(this._socket.end$.subscribe(() => {
      this.log('Socket ended.');
    })));

    this._socketDisposables.add(toDisposable(this._socket.close$.subscribe(() => {
      this.log('Socket closed.');
    })));
  }

  private _ensureInteractiveEvents() {
    this._socketDisposables.add(toDisposable(this._socket.keyboardInteractive$.subscribe(({ name, instructions, prompts, finish }) => {
      const promptText = prompts[0]?.prompt?.toLowerCase?.() ?? '';
      const shouldAutoReply = !!this._password
        && prompts.length === 1
        && /password|passphrase|passwd|密码/.test(promptText);

      if (shouldAutoReply) {
        finish([this._password as string]);
        return;
      }

      this._pendingKeyboardInteractiveFinish = finish;
      this._event$.next({
        type: 'keyboard_interactive',
        name,
        instructions,
        prompts: prompts.map((p) => ({ prompt: p.prompt, echo: p.echo ?? false })),
      });
    })));

    this._socketDisposables.add(toDisposable(this._socket.changePassword$.subscribe(({ message, done }) => {
      this._pendingChangePasswordDone = done;
      this._event$.next({ type: 'change_password', message });
    })));

    this._socketDisposables.add(toDisposable(this._socket.banner$.subscribe((message) => {
      this._event$.next({ type: 'banner', message });
    })));
  }

  override dispose(): void {
    this._middlewareStack.dispose();
    this._x11Disposables.dispose();
    this._socketDisposables.dispose();
    this._chainDisposables.dispose();
    if (this._hostChain) {
      this._hostChain.dispose();
      this._hostChain = null;
    }
    super.dispose();
    this._status$.complete();
    this._connected$.complete();
    this._data$.complete();
    this._error$.complete();
    this._event$.complete();
  }
}

function formatSocketError(err: Error & { code?: string; level?: string }): string {
  const parts = [err.message, err.code, err.level].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.join(' | ') || String(err);
}

function getStatusAndBefore(socketStatus: SSHSocketStatus): Observable<SSHSocketStatus> {
  switch (socketStatus) {
    case SSHSocketStatus.CONNECTING:
    case SSHSocketStatus.CONNECTED:
      return of(
        SSHSocketStatus.IDLE,
        SSHSocketStatus.CONNECTING
      );
    case SSHSocketStatus.READY:
      return of(
        SSHSocketStatus.IDLE,
        SSHSocketStatus.CONNECTING,
        SSHSocketStatus.CONNECTED,
        SSHSocketStatus.READY
      );
    case SSHSocketStatus.CLOSED:
      return of(
        SSHSocketStatus.IDLE,
        SSHSocketStatus.CONNECTING,
        SSHSocketStatus.CONNECTED,
        SSHSocketStatus.READY,
        SSHSocketStatus.CLOSED
      );
    default:
      return of(SSHSocketStatus.IDLE);
  }
}

function mapSocketStatusToSessionStatus(status: SSHSocketStatus): SSHSessionStatus {
  switch (status) {
    case SSHSocketStatus.CONNECTING:
      return SSHSessionStatus.CONNECTING;
    case SSHSocketStatus.CONNECTED:
      return SSHSessionStatus.AUTHENTICATING;
    case SSHSocketStatus.READY:
      return SSHSessionStatus.OPENING_SHELL;
    case SSHSocketStatus.CLOSED:
      return SSHSessionStatus.CLOSED;
    default:
      return SSHSessionStatus.IDLE;
  }
}
