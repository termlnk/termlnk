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

import type { ISFTPFileAttrs, ISFTPFileEntry, ISFTPTransferTask, SFTPSessionEvent, SFTPSessionStatus } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export interface ISFTPClientService {
  // Session management
  createSession(hostId: string, password?: string): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  retrySession(sessionId: string, password: string): Promise<void>;
  respondKeyboardInteractive(sessionId: string, responses: string[], viaHopId?: string): Promise<void>;
  respondChangePassword(sessionId: string, newPassword: string, viaHopId?: string): Promise<void>;

  // File operations
  list(sessionId: string, path: string): Promise<ISFTPFileEntry[]>;
  stat(sessionId: string, path: string): Promise<ISFTPFileAttrs>;
  mkdir(sessionId: string, path: string): Promise<void>;
  rmdir(sessionId: string, path: string): Promise<void>;
  unlink(sessionId: string, path: string): Promise<void>;
  rename(sessionId: string, oldPath: string, newPath: string): Promise<void>;
  chmod(sessionId: string, path: string, mode: number): Promise<void>;
  readFile(sessionId: string, path: string): Promise<string>;
  writeFile(sessionId: string, path: string, content: string): Promise<void>;
  realpath(sessionId: string, path: string): Promise<string>;

  // Transfer
  download(sessionId: string, remotePath: string, localPath: string): Promise<string>;
  upload(sessionId: string, localPath: string, remotePath: string): Promise<string>;
  uploadDirectory(sessionId: string, localBasePath: string, remoteBasePath: string, entries: Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }>): Promise<string[]>;
  cancelTransfer(transferId: string): Promise<void>;

  // Subscriptions
  status$(sessionId: string): Observable<SFTPSessionStatus>;
  event$(sessionId: string): Observable<SFTPSessionEvent>;
  transferProgress$(sessionId: string): Observable<ISFTPTransferTask>;
}
export const ISFTPClientService = createIdentifier<ISFTPClientService>('rpc-client.sftp-service');

export class SFTPClientService extends Disposable implements ISFTPClientService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  async createSession(hostId: string, password?: string): Promise<string> {
    return this._getSftpClient().createSession.mutate({ hostId, password });
  }

  async closeSession(sessionId: string): Promise<void> {
    await this._getSftpClient().closeSession.mutate(sessionId);
  }

  async retrySession(sessionId: string, password: string): Promise<void> {
    await this._getSftpClient().retrySession.mutate({ sessionId, password });
  }

  async respondKeyboardInteractive(sessionId: string, responses: string[], viaHopId?: string): Promise<void> {
    await this._getSftpClient().respondKeyboardInteractive.mutate({ sessionId, responses, viaHopId });
  }

  async respondChangePassword(sessionId: string, newPassword: string, viaHopId?: string): Promise<void> {
    await this._getSftpClient().respondChangePassword.mutate({ sessionId, newPassword, viaHopId });
  }

  // --- File operations ---

  async list(sessionId: string, path: string): Promise<ISFTPFileEntry[]> {
    return this._getSftpClient().list.query({ sessionId, path });
  }

  async stat(sessionId: string, path: string): Promise<ISFTPFileAttrs> {
    return this._getSftpClient().stat.query({ sessionId, path });
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    await this._getSftpClient().mkdir.mutate({ sessionId, path });
  }

  async rmdir(sessionId: string, path: string): Promise<void> {
    await this._getSftpClient().rmdir.mutate({ sessionId, path });
  }

  async unlink(sessionId: string, path: string): Promise<void> {
    await this._getSftpClient().unlink.mutate({ sessionId, path });
  }

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    await this._getSftpClient().rename.mutate({ sessionId, oldPath, newPath });
  }

  async chmod(sessionId: string, path: string, mode: number): Promise<void> {
    await this._getSftpClient().chmod.mutate({ sessionId, path, mode });
  }

  async readFile(sessionId: string, path: string): Promise<string> {
    return this._getSftpClient().readFile.query({ sessionId, path });
  }

  async writeFile(sessionId: string, path: string, content: string): Promise<void> {
    await this._getSftpClient().writeFile.mutate({ sessionId, path, content });
  }

  async realpath(sessionId: string, path: string): Promise<string> {
    return this._getSftpClient().realpath.query({ sessionId, path });
  }

  // --- Transfer ---

  async download(sessionId: string, remotePath: string, localPath: string): Promise<string> {
    return this._getSftpClient().download.mutate({ sessionId, remotePath, localPath });
  }

  async upload(sessionId: string, localPath: string, remotePath: string): Promise<string> {
    return this._getSftpClient().upload.mutate({ sessionId, localPath, remotePath });
  }

  async uploadDirectory(
    sessionId: string,
    localBasePath: string,
    remoteBasePath: string,
    entries: Array<{ absolutePath: string; relativePath: string; isDirectory: boolean }>
  ): Promise<string[]> {
    return this._getSftpClient().uploadDirectory.mutate({ sessionId, localBasePath, remoteBasePath, entries });
  }

  async cancelTransfer(transferId: string): Promise<void> {
    await this._getSftpClient().cancelTransfer.mutate(transferId);
  }

  status$(sessionId: string): Observable<SFTPSessionStatus> {
    return trpcSubscriptionToObservable((opts) =>
      this._getSftpClient().status$.subscribe(sessionId, opts)
    );
  }

  event$(sessionId: string): Observable<SFTPSessionEvent> {
    return trpcSubscriptionToObservable((opts) =>
      this._getSftpClient().event$.subscribe(sessionId, opts)
    );
  }

  transferProgress$(sessionId: string): Observable<ISFTPTransferTask> {
    return trpcSubscriptionToObservable((opts) =>
      this._getSftpClient().transferProgress$.subscribe(sessionId, opts)
    );
  }

  private _getSftpClient() {
    return this._rpcClientService.getClient().sftp;
  }
}
