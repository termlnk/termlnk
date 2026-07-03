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

import type { FileTransferEvent, IFileTransferService } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, Optional } from '@termlnk/core';
import { FileTransferEventType, ISSHSessionService } from '@termlnk/rpc';
import { Subject } from 'rxjs';
import { createTrzszMiddleware } from '../middleware/trzsz-middleware';
import { createZModemMiddleware } from '../middleware/zmodem-middleware';
import { IFileDialogService } from './file-dialog.service';

export class FileTransferService extends Disposable implements IFileTransferService {
  private _eventSubjects = new Map<string, Subject<FileTransferEvent>>();

  constructor(
    @ISSHSessionService private readonly _sshSessionService: ISSHSessionService,
    @ILogService private readonly _logService: ILogService,
    @Optional(IFileDialogService) private readonly _fileDialogService?: IFileDialogService
  ) {
    super();
  }

  transferEvent$(sessionId: string): Observable<FileTransferEvent> {
    return this._getOrCreateSubject(sessionId).asObservable();
  }

  initSession(sessionId: string): void {
    const session = this._sshSessionService.getSession(sessionId);
    if (!session) {
      return;
    }

    this._reinitMiddlewares(sessionId, session);
    this._logService.log('[FileTransfer]', `Initialized middlewares for session ${sessionId}`);
  }

  disposeSession(sessionId: string): void {
    const session = this._sshSessionService.getSession(sessionId);
    if (session) {
      session.middlewareStack.remove('trzsz');
      session.middlewareStack.remove('zmodem');
    }

    const subject = this._eventSubjects.get(sessionId);
    if (subject) {
      subject.complete();
      this._eventSubjects.delete(sessionId);
    }
  }

  async cancelTransfer(sessionId: string): Promise<void> {
    const session = this._sshSessionService.getSession(sessionId);
    if (!session) {
      return;
    }

    // Emit cancelled event so the UI can react
    const subject = this._eventSubjects.get(sessionId);
    if (subject) {
      subject.next({ type: FileTransferEventType.CANCELLED, protocol: 'zmodem' });
    }

    // Remove old middlewares (cancels any active transfer),
    // then re-add fresh ones. Keep the subject alive so the
    // client subscription continues to work for future transfers.
    session.middlewareStack.remove('trzsz');
    session.middlewareStack.remove('zmodem');
    this._reinitMiddlewares(sessionId, session);
  }

  override dispose(): void {
    for (const subject of this._eventSubjects.values()) {
      subject.complete();
    }
    this._eventSubjects.clear();
    super.dispose();
  }

  private _getOrCreateSubject(sessionId: string): Subject<FileTransferEvent> {
    let subject = this._eventSubjects.get(sessionId);
    if (!subject) {
      subject = new Subject<FileTransferEvent>();
      this._eventSubjects.set(sessionId, subject);
    }
    return subject;
  }

  private _reinitMiddlewares(sessionId: string, session: ReturnType<ISSHSessionService['getSession']> & {}): void {
    const subject = this._getOrCreateSubject(sessionId);
    const emitProgress = (event: FileTransferEvent) => {
      if (event.type === FileTransferEventType.STARTED) {
        event = { ...event, sessionId };
      }
      subject.next(event);
    };

    const trzszMiddleware = createTrzszMiddleware(
      {
        onUploadRequest: async (directory: boolean) => {
          const files = await this._fileDialogService?.showOpenDialog({
            title: directory ? 'Select files and directories to upload' : 'Select files to upload',
            directory,
            multiple: true,
          });
          return files?.length ? files : undefined;
        },
        onDownloadRequest: async () => {
          const dirs = await this._fileDialogService?.showOpenDialog({
            title: 'Select download directory',
            directory: true,
          });
          return dirs?.[0] ?? undefined;
        },
        onProgress: emitProgress,
      },
      (data) => session.rawWrite(data),
      (data) => session.pushData(data),
      () => session.cols
    );

    const zmodemMiddleware = createZModemMiddleware(
      {
        onDownloadRequest: async (offer) => {
          const savePath = await this._fileDialogService?.showSaveDialog({
            defaultFileName: offer.name,
            title: `Download: ${offer.name}`,
          });
          return savePath || null;
        },
        onUploadRequest: async (): Promise<string[]> => {
          const files = await this._fileDialogService?.showOpenDialog({
            title: 'Select files to upload',
            multiple: true,
          });
          return files ?? [];
        },
        onProgress: emitProgress,
      },
      (data) => session.rawWrite(data)
    );

    session.middlewareStack.push(trzszMiddleware);
    session.middlewareStack.push(zmodemMiddleware);
  }
}
