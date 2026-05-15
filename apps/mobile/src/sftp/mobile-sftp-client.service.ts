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

// SFTP service on top of @termlnk/react-native-russh. The subsystem is opened on the same
// SSH connection via IMobileSshSession.openSftp() — no second TCP handshake.

import type {
  ISftpEntry,
  ISftpSession,
  ISftpTransferHandle,
} from '@termlnk/react-native-russh';
import type { Observable } from 'rxjs';
import type { IMobileSshSession } from '../ssh/mobile-ssh-client.service';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export type SftpState = 'idle' | 'connecting' | 'ready' | 'transferring' | 'error';

export type { ISftpEntry, ISftpTransferHandle };

export class MobileSftpClientService extends Disposable {
  private readonly _state$ = new BehaviorSubject<SftpState>('idle');
  readonly state$: Observable<SftpState> = this._state$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<string | null>(null);
  readonly lastError$: Observable<string | null> = this._lastError$.asObservable();

  private _session: ISftpSession | null = null;

  constructor(private readonly _ssh: IMobileSshSession) {
    super();
  }

  get state(): SftpState {
    return this._state$.getValue();
  }

  get lastError(): string | null {
    return this._lastError$.getValue();
  }

  override dispose(): void {
    const session = this._session;
    this._session = null;
    if (session) {
      void session.close().catch(() => {
        // Best-effort.
      });
    }
    this._state$.next('idle');
    this._state$.complete();
    this._lastError$.complete();
    super.dispose();
  }

  async connect(): Promise<void> {
    if (this._session) {
      return;
    }
    this._state$.next('connecting');
    try {
      this._session = await this._ssh.openSftp();
      this._state$.next('ready');
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  async list(path: string): Promise<readonly ISftpEntry[]> {
    return this._call((s) => s.list(path));
  }

  async stat(path: string) {
    return this._call((s) => s.stat(path));
  }

  async mkdir(path: string, mode?: number): Promise<void> {
    await this._call((s) => s.mkdir(path, mode));
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this._call((s) => s.rename(oldPath, newPath));
  }

  async remove(path: string): Promise<void> {
    await this._call((s) => s.remove(path));
  }

  async removeDirectory(path: string): Promise<void> {
    await this._call((s) => s.rmdir(path));
  }

  async chmod(path: string, permissions: number): Promise<void> {
    await this._call((s) => s.chmod(path, permissions));
  }

  upload(
    localFilePath: string,
    remoteFilePath: string,
    opts?: { onProgress?: (bytesDone: bigint, total?: bigint) => void }
  ): ISftpTransferHandle {
    const session = this._requireSession();
    this._state$.next('transferring');
    const handle = session.upload(localFilePath, remoteFilePath, {
      onProgress: opts?.onProgress
        ? (p) => opts.onProgress!(p.bytesDone, p.total)
        : undefined,
    });
    handle.done
      .then(() => this._state$.next('ready'))
      .catch((err) => this._failWith(err));
    return handle;
  }

  download(
    remoteFilePath: string,
    localFilePath: string,
    opts?: { onProgress?: (bytesDone: bigint, total?: bigint) => void }
  ): ISftpTransferHandle {
    const session = this._requireSession();
    this._state$.next('transferring');
    const handle = session.download(remoteFilePath, localFilePath, {
      onProgress: opts?.onProgress
        ? (p) => opts.onProgress!(p.bytesDone, p.total)
        : undefined,
    });
    handle.done
      .then(() => this._state$.next('ready'))
      .catch((err) => this._failWith(err));
    return handle;
  }

  private async _call<T>(fn: (s: ISftpSession) => Promise<T>): Promise<T> {
    const session = this._requireSession();
    try {
      return await fn(session);
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  private _requireSession(): ISftpSession {
    if (!this._session) {
      throw new Error('SFTP session not connected — call connect() first.');
    }
    return this._session;
  }

  private _failWith(err: unknown): void {
    this._lastError$.next(err instanceof Error ? err.message : String(err));
    this._state$.next('error');
  }
}
