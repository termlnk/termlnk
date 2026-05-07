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
import type { SFTPSessionEvent } from '@termlnk/rpc';
import type { Buffer } from 'node:buffer';
import type { Observable } from 'rxjs';
import type { ChangePasswordCallback, FileEntry, KeyboardInteractiveCallback, SFTPWrapper, Stats } from 'ssh2';
import type { IHostChainHandle } from '../ssh/ssh-host-chain.service';
import type { ISSHSocket } from '../ssh/ssh-socket';
import process from 'node:process';
import { Disposable, DisposableCollection, ILogService, takeAfter, toDisposable } from '@termlnk/core';
import { SFTPSessionStatus, SSHSocketStatus } from '@termlnk/rpc';
import { BehaviorSubject, merge, of, ReplaySubject, skip } from 'rxjs';
import { ISSHSocketService } from '../ssh/ssh-socket.service';

export interface ISFTPFileEntry {
  filename: string;
  longname: string;
  attrs: ISFTPFileAttrs;
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface ISFTPFileAttrs {
  mode: number;
  uid: number;
  gid: number;
  size: number;
  atime: number;
  mtime: number;
}

export class SFTPSession extends Disposable implements IDisposable {
  private readonly _status$ = new BehaviorSubject<SFTPSessionStatus>(SFTPSessionStatus.IDLE);
  readonly status$ = this._status$.asObservable();
  get status(): SFTPSessionStatus {
    return this._status$.getValue();
  }

  private readonly _event$ = new ReplaySubject<SFTPSessionEvent>(50);
  readonly event$ = this._event$.asObservable();

  private _sftp: Nullable<SFTPWrapper>;
  private _socketDisposables = new DisposableCollection();
  private _chainDisposables = new DisposableCollection();
  private _pendingKeyboardInteractiveFinish: Nullable<KeyboardInteractiveCallback> = null;
  private _pendingChangePasswordDone: Nullable<ChangePasswordCallback> = null;
  private _hostChain: Nullable<IHostChainHandle> = null;

  constructor(
    public readonly sessionId: string,
    private _socket: ISSHSocket,
    public readonly hostId: string,
    private _password: Nullable<string>,
    @ISSHSocketService private readonly _sshSocketService: ISSHSocketService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._ensureSocketStatusEvent();
    this._ensureInteractiveEvents();
    this._init();
  }

  get socketId(): string {
    return this._socket.id;
  }

  private _init() {
    if (this._socket.status === SSHSocketStatus.READY) {
      this._ensureSFTP();
    }
    this._socketDisposables.add(toDisposable(this._socket.ready$.subscribe(async () => {
      this._ensureSFTP();
    })));
    this._ensureSocketDiagnostics();
  }

  async close(): Promise<void> {
    if (this._sftp) {
      this._sftp.end();
      this._sftp = null;
    }
    this._sshSocketService.releaseSocket(this._socket.id);
    this._status$.next(SFTPSessionStatus.CLOSED);
  }

  rebindSocket(socket: ISSHSocket): void {
    this._socketDisposables.dispose();
    this._socketDisposables = new DisposableCollection();
    this._socket = socket;
    this._sftp = null;
    this._ensureSocketStatusEvent();
    this._ensureInteractiveEvents();
    this._init();
  }

  /**
   * Attach a host chain handle. Mirrors SSHSession.attachHostChain: the
   * session takes ownership and immediately advances status to CONNECTING
   * so the renderer can see SFTP progress while the chain is building.
   */
  attachHostChain(chain: IHostChainHandle): void {
    if (this._hostChain) {
      this._chainDisposables.dispose();
      this._hostChain.dispose();
    }
    this._hostChain = chain;
    this._chainDisposables = new DisposableCollection();
    this._chainDisposables.add(toDisposable(chain.hopEvent$.subscribe((hopEvent) => {
      const event = hopEvent.event;
      if (event.type === 'keyboard_interactive' || event.type === 'change_password' || event.type === 'auth_failed') {
        this._event$.next(event as SFTPSessionEvent);
      }
    })));
    this._chainDisposables.add(toDisposable(chain.progress$.subscribe(({ hopId, hopLabel, hopIndex, hopCount, status, message }) => {
      this._event$.next({ type: 'hop_progress', hopId, hopLabel, hopIndex, hopCount, status, message });
    })));
    this._status$.next(SFTPSessionStatus.CONNECTING);
  }

  /** Surface a failed chain build as a session-level error. */
  markChainFailed(err: Error): void {
    const message = formatSocketError(err as Error & { code?: string; level?: string });
    this._status$.next(SFTPSessionStatus.ERROR);
    this._event$.next({ type: 'error', message });
    this._logService.error('[SFTPSession] Host chain failed', err);
  }

  setPassword(password?: string): void {
    this._password = password ?? null;
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

  async list(remotePath: string): Promise<ISFTPFileEntry[]> {
    const sftp = await this._ensureSFTP();
    return new Promise<ISFTPFileEntry[]>((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(list.map((entry) => mapFileEntry(entry)));
      });
    });
  }

  async stat(remotePath: string): Promise<ISFTPFileAttrs> {
    const sftp = await this._ensureSFTP();
    return new Promise<ISFTPFileAttrs>((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(mapStats(stats));
      });
    });
  }

  async mkdir(remotePath: string): Promise<void> {
    const sftp = await this._ensureSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async rmdir(remotePath: string): Promise<void> {
    const sftp = await this._ensureSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async unlink(remotePath: string): Promise<void> {
    const sftp = await this._ensureSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const sftp = await this._ensureSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async chmod(remotePath: string, mode: number): Promise<void> {
    const sftp = await this._ensureSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async readFile(remotePath: string): Promise<Buffer> {
    const sftp = await this._ensureSFTP();
    return new Promise<Buffer>((resolve, reject) => {
      sftp.readFile(remotePath, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  }

  async writeFile(remotePath: string, data: Buffer): Promise<void> {
    const sftp = await this._ensureSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.writeFile(remotePath, data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async download(
    remotePath: string,
    localPath: string,
    onProgress: (transferred: number, total: number) => void
  ): Promise<void> {
    const sftp = await this._ensureSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, {
        step: (transferred, _chunk, total) => {
          onProgress(transferred, total);
        },
      }, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async upload(
    localPath: string,
    remotePath: string,
    onProgress: (transferred: number, total: number) => void
  ): Promise<void> {
    const sftp = await this._ensureSFTP();
    // Electron patches node:fs to treat .asar files as virtual directories.
    // Bypass the interception so ssh2 can read the real file.
    // noAsar must remain true for the entire transfer duration since
    // ssh2's fastPut reads the local file in chunks over time.
    const prev = (process as any).noAsar;
    (process as any).noAsar = true;
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.fastPut(localPath, remotePath, {
          step: (transferred, _chunk, total) => {
            onProgress(transferred, total);
          },
        }, (err) => {
          err ? reject(err) : resolve();
        });
      });
    } finally {
      (process as any).noAsar = prev;
    }
  }

  async realpath(remotePath: string): Promise<string> {
    const sftp = await this._ensureSFTP();
    return new Promise<string>((resolve, reject) => {
      sftp.realpath(remotePath, (err, absPath) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(absPath);
      });
    });
  }

  // --- Internal ---

  private async _ensureSFTP(): Promise<SFTPWrapper> {
    if (this._sftp) return this._sftp;

    if (this._socket.status !== SSHSocketStatus.READY) {
      throw new Error('SSH socket is not ready');
    }

    this._status$.next(SFTPSessionStatus.OPENING_SFTP);
    try {
      this._sftp = await this._socket.sftp();
      this._sftp.on('close', () => {
        this._sftp = null;
        this._status$.next(SFTPSessionStatus.CLOSED);
      });
      this._status$.next(SFTPSessionStatus.READY);
      return this._sftp;
    } catch (err) {
      this._status$.next(SFTPSessionStatus.ERROR);
      this._event$.next({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  private _ensureSocketStatusEvent() {
    const socketStatus$ = this._socket.status$.pipe(skip(1));
    const status$ = merge(
      getStatusAndBefore(this._socket.status),
      socketStatus$
    ).pipe(takeAfter((e) => e === SSHSocketStatus.CLOSED));

    this._socketDisposables.add(toDisposable(status$.subscribe((status) => {
      this._status$.next(mapSocketStatusToSFTPStatus(status));
    })));

    this._socketDisposables.add(toDisposable(this._socket.error$.subscribe(({ err }) => {
      if (!err) return;
      const message = formatSocketError(err);
      const isAuthError = (err as any).level === 'client-authentication';
      if (isAuthError) {
        this._status$.next(SFTPSessionStatus.AUTH_FAILED);
        this._event$.next({ type: 'auth_failed', message });
      } else {
        this._status$.next(SFTPSessionStatus.ERROR);
        this._event$.next({ type: 'error', message });
      }
      this._logService.error('[SFTPSession] Socket error', err);
    })));
  }

  private _ensureSocketDiagnostics() {
    this._socketDisposables.add(toDisposable(this._socket.connect$.subscribe(() => {
      this._logService.debug('TCP connected.');
    })));

    this._socketDisposables.add(toDisposable(this._socket.ready$.subscribe(() => {
      this._logService.debug('Authentication successful. Opening SFTP...');
    })));

    this._socketDisposables.add(toDisposable(this._socket.timeout$.subscribe(() => {
      const message = 'Connection timeout.';
      this._status$.next(SFTPSessionStatus.ERROR);
      this._event$.next({ type: 'error', message });
      this._logService.debug(message);
      this._socket.destroy();
    })));

    this._socketDisposables.add(toDisposable(this._socket.close$.subscribe(() => {
      this._logService.debug('Socket closed.');
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
  }

  override dispose(): void {
    this._sftp?.end();
    this._sftp = null;
    this._socketDisposables.dispose();
    this._chainDisposables.dispose();
    if (this._hostChain) {
      this._hostChain.dispose();
      this._hostChain = null;
    }
    super.dispose();
    this._status$.complete();
    this._event$.complete();
  }
}

function mapFileEntry(entry: FileEntry): ISFTPFileEntry {
  const attrs = entry.attrs;
  const mode = attrs.mode ?? 0;
  return {
    filename: entry.filename,
    longname: entry.longname,
    attrs: {
      mode,
      uid: attrs.uid ?? 0,
      gid: attrs.gid ?? 0,
      size: attrs.size ?? 0,
      atime: attrs.atime ?? 0,
      mtime: attrs.mtime ?? 0,
    },
    isDirectory: (mode & 0o40000) !== 0,
    isSymlink: (mode & 0o120000) === 0o120000,
  };
}

function mapStats(stats: Stats): ISFTPFileAttrs {
  return {
    mode: stats.mode ?? 0,
    uid: stats.uid ?? 0,
    gid: stats.gid ?? 0,
    size: stats.size ?? 0,
    atime: stats.atime ?? 0,
    mtime: stats.mtime ?? 0,
  };
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

function mapSocketStatusToSFTPStatus(status: SSHSocketStatus): SFTPSessionStatus {
  switch (status) {
    case SSHSocketStatus.CONNECTING:
      return SFTPSessionStatus.CONNECTING;
    case SSHSocketStatus.CONNECTED:
      return SFTPSessionStatus.AUTHENTICATING;
    case SSHSocketStatus.READY:
      return SFTPSessionStatus.OPENING_SFTP;
    case SSHSocketStatus.CLOSED:
      return SFTPSessionStatus.CLOSED;
    default:
      return SFTPSessionStatus.IDLE;
  }
}
