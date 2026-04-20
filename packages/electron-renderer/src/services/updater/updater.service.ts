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

import type { IUpdateError, IUpdateInfo, IUpdateProgress, IUpdaterService, UpdateStatus } from '@termlnk/electron';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '@termlnk/rpc-client';

export class UpdaterService extends Disposable implements IUpdaterService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return (this._rpcClientService.getClient() as any).updater;
  }

  readonly status$: Observable<UpdateStatus> = trpcSubscriptionToObservable(
    (opts) => this._client.status$.subscribe(undefined, opts)
  );

  readonly updateInfo$: Observable<IUpdateInfo> = trpcSubscriptionToObservable(
    (opts) => this._client.updateInfo$.subscribe(undefined, opts)
  );

  readonly progress$: Observable<IUpdateProgress> = trpcSubscriptionToObservable(
    (opts) => this._client.progress$.subscribe(undefined, opts)
  );

  readonly error$: Observable<IUpdateError> = trpcSubscriptionToObservable(
    (opts) => this._client.error$.subscribe(undefined, opts)
  );

  async getCurrentVersion(): Promise<string> {
    return this._client.getCurrentVersion.query();
  }

  async getStatus(): Promise<UpdateStatus> {
    return this._client.getStatus.query();
  }

  async checkForUpdates(): Promise<IUpdateInfo | null> {
    return this._client.checkForUpdates.mutate();
  }

  async downloadUpdate(): Promise<void> {
    await this._client.downloadUpdate.mutate();
  }

  async quitAndInstall(isSilent = false, isForceRunAfter = true): Promise<void> {
    await this._client.quitAndInstall.mutate({ isSilent, isForceRunAfter });
  }
}
