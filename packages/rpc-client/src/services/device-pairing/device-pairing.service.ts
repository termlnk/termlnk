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

import type { IDevicePairingService, IRemoteAnnouncedSession } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

/**
 * Renderer-side facade over the tRPC `devicePairing` router. Same-account
 * cross-device shared session discovery — the renderer-side "From other
 * devices" list reads this.
 */
export class DevicePairingService extends Disposable implements IDevicePairingService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().devicePairing;
  }

  readonly remoteSessions$: Observable<readonly IRemoteAnnouncedSession[]> = trpcSubscriptionToObservable<readonly IRemoteAnnouncedSession[]>(
    (opts) => this._client.remoteSessions$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async list(): Promise<readonly IRemoteAnnouncedSession[]> {
    return this._client.listRemoteSessions.query() as Promise<readonly IRemoteAnnouncedSession[]>;
  }

  async refresh(): Promise<void> {
    await this._client.refreshRemoteSessions.mutate();
  }

  async announceSession(sessionId: string, title: string, cols: number, rows: number): Promise<void> {
    await this._client.announceDeviceSession.mutate({ sessionId, title, cols, rows });
  }

  async retractSession(sessionId: string): Promise<void> {
    await this._client.retractDeviceSession.mutate(sessionId);
  }
}
