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

import type { Observable } from 'rxjs';
import type { FileTransferEvent } from '../../models/file-transfer';
import { createIdentifier } from '@termlnk/core';

export interface IFileTransferService {
  transferEvent$(sessionId: string): Observable<FileTransferEvent>;
  // Main-process only — wires up the trzsz/zmodem middleware stack for an SSH
  // session. Renderer implementation throws because it has no SSH session handle.
  initSession(sessionId: string): void;
  // Main-process only — mirror of initSession; throws on the renderer.
  disposeSession(sessionId: string): void;
  cancelTransfer(sessionId: string): Promise<void>;
}
export const IFileTransferService = createIdentifier<IFileTransferService>('rpc.file-transfer-service');
