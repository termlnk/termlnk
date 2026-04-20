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

import type { FileTransferEvent } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export interface IFileTransferClientService {
  transferEvent$(sessionId: string): Observable<FileTransferEvent>;
  cancelTransfer(sessionId: string): Promise<void>;
}
export const IFileTransferClientService = createIdentifier<IFileTransferClientService>('rpc-client.file-transfer-service');

export class FileTransferClientService extends Disposable implements IFileTransferClientService {
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
}
