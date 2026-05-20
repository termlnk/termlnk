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
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

const MAIN_PROCESS_ONLY_MESSAGE = '[FileTransferService] this method is only available in the main process';

export class FileTransferService extends Disposable implements IFileTransferService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().fileTransfer;
  }

  transferEvent$(sessionId: string): Observable<FileTransferEvent> {
    return trpcSubscriptionToObservable<FileTransferEvent>((opts) =>
      this._client.transferEvent$.subscribe(sessionId, opts)
    );
  }

  async cancelTransfer(sessionId: string): Promise<void> {
    await this._client.cancelTransfer.mutate(sessionId);
  }

  // Renderer has no SSH session handle — middleware lifecycle stays in the main process.
  initSession(_sessionId: string): void {
    throw new Error(MAIN_PROCESS_ONLY_MESSAGE);
  }

  disposeSession(_sessionId: string): void {
    throw new Error(MAIN_PROCESS_ONLY_MESSAGE);
  }
}
