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

import type { ICollabInvite, IInviteClaimResult, IInviteCreateOptions, IInviteService, IInviteTokenState, IPairedDevice } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { share, shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

/**
 * Renderer-side facade over the tRPC `invite` router.
 *
 * Drives the owner-side "create / revoke invite" UX, the joiner-side
 * "you've been invited" dialog (via `inviteUrl$`), and the paired-device
 * list — these three lifecycles share enough state that splitting them
 * further would only add ceremony.
 */
export class InviteService extends Disposable implements IInviteService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().invite;
  }

  readonly outstandingInvites$: Observable<readonly IInviteTokenState[]> = trpcSubscriptionToObservable<readonly IInviteTokenState[]>(
    (opts) => this._client.outstandingInvites$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly inviteHistory$: Observable<readonly IInviteTokenState[]> = trpcSubscriptionToObservable<readonly IInviteTokenState[]>(
    (opts) => this._client.inviteHistory$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly inviteClaims$: Observable<IInviteClaimResult> = trpcSubscriptionToObservable<IInviteClaimResult>(
    (opts) => this._client.inviteClaims$.subscribe(undefined, opts)
  ).pipe(share());

  async createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }> {
    return this._client.createInvite.mutate(options) as Promise<{ invite: ICollabInvite; url: string }>;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this._client.revokeInvite.mutate(inviteId);
  }

  async listInvites(): Promise<readonly IInviteTokenState[]> {
    return this._client.listInvites.query() as Promise<readonly IInviteTokenState[]>;
  }

  readonly pairedDevices$: Observable<readonly IPairedDevice[]> = trpcSubscriptionToObservable<readonly IPairedDevice[]>(
    (opts) => this._client.pairedDevices$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async revokeDevice(deviceId: string): Promise<void> {
    await this._client.revokeDevice.mutate(deviceId);
  }

  readonly inviteUrl$: Observable<string> = trpcSubscriptionToObservable<string>(
    (opts) => this._client.inviteUrl$.subscribe(undefined, opts)
  ).pipe(share());
}
