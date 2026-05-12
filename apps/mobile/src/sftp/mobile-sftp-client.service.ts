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

import type SSHClient from '@dylankenneally/react-native-ssh-sftp';
import type { LsResult } from '@dylankenneally/react-native-ssh-sftp';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

// SFTP wrapper over the same underlying NMSSH/JSch client as MobileSshClientService.
// dylankenneally's binding gives us SFTP through the *same* SSHClient instance — we
// share the channel rather than spawning a second SSH session per host. The lib lazily
// opens the SFTP sub-channel on the first sftp* call; checkSFTP() inside the lib
// guarantees it. We expose connectSFTP() too because the iOS bridge surfaces clearer
// error messages when the SFTP handshake fails up front.
//
// Why a thin wrapper at all (vs. UI calling SSHClient directly):
//   - Single point to translate native `any` errors into typed exceptions.
//   - state$ Observable so the UI can light up a "connecting…" spinner.
//   - Future hook point for chunked-upload progress + resumable uploads (NMSSH ships
//     sftpUpload only — to resume a partial upload we'd need to slice the local file
//     and recompose via execute('cat >>'). Deferred to P6.5b until UI lands.

export type SftpState = 'idle' | 'connecting' | 'ready' | 'transferring' | 'error';

export interface ISftpEntry {
  readonly filename: string;
  readonly isDirectory: boolean;
  readonly modificationDate: string;
  readonly fileSize: number;
}

function adaptEntry(raw: LsResult): ISftpEntry {
  return {
    filename: raw.filename,
    isDirectory: raw.isDirectory,
    modificationDate: raw.modificationDate,
    fileSize: raw.fileSize,
  };
}

export class MobileSftpClientService extends Disposable {
  readonly state$ = new BehaviorSubject<SftpState>('idle');
  readonly lastError$ = new BehaviorSubject<string | null>(null);

  constructor(private readonly _ssh: SSHClient) {
    super();
  }

  override dispose(): void {
    try {
      this._ssh.disconnectSFTP();
    } catch {
      // Ignore — disconnectSFTP throws when never connected; we treat dispose as best-effort.
    }
    this.state$.next('idle');
    this.state$.complete();
    this.lastError$.complete();
    super.dispose();
  }

  async connect(): Promise<void> {
    this.state$.next('connecting');
    try {
      await this._ssh.connectSFTP();
      this.state$.next('ready');
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  async list(path: string): Promise<readonly ISftpEntry[]> {
    try {
      const entries = await this._ssh.sftpLs(path);
      return entries.map(adaptEntry);
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  async mkdir(path: string): Promise<void> {
    try {
      await this._ssh.sftpMkdir(path);
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      await this._ssh.sftpRename(oldPath, newPath);
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await this._ssh.sftpRm(path);
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  async removeDirectory(path: string): Promise<void> {
    try {
      await this._ssh.sftpRmdir(path);
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  // Native lib runs the transfer on a background thread and resolves when finished.
  // No progress events are surfaced; cancelling routes through cancelUpload(). v1 ships
  // without progress UI — the simple `state$` flip to 'transferring' is enough for the
  // mobile UX. v1.x can layer a chunked transfer with `execute('cat | dd …')` if needed.
  async upload(localFilePath: string, remoteFilePath: string): Promise<void> {
    this.state$.next('transferring');
    try {
      await this._ssh.sftpUpload(localFilePath, remoteFilePath);
      this.state$.next('ready');
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  cancelUpload(): void {
    this._ssh.sftpCancelUpload();
  }

  async download(remoteFilePath: string, localFilePath: string): Promise<string> {
    this.state$.next('transferring');
    try {
      const result = await this._ssh.sftpDownload(remoteFilePath, localFilePath);
      this.state$.next('ready');
      return result;
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  cancelDownload(): void {
    this._ssh.sftpCancelDownload();
  }

  // Android-only on the underlying lib; iOS silently no-ops. Surfacing as no-throw on
  // iOS would hide the platform mismatch — we let the lib's native error propagate so
  // UI can show "chmod not supported on iOS targets" if the user attempts it.
  async chmod(path: string, permissions: number): Promise<void> {
    try {
      await this._ssh.sftpChmod(path, permissions);
    } catch (err) {
      this._failWith(err);
      throw err;
    }
  }

  private _failWith(err: unknown): void {
    this.lastError$.next(err instanceof Error ? err.message : String(err));
    this.state$.next('error');
  }
}
