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

import type { IDriverState, IParticipant, IShareableSession, IShareSessionOptions, ISharedSession, ISharedSessionService } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

/**
 * Renderer-side facade over the tRPC `sharedSession` router.
 *
 * Owner control plane — sessions / participants / driver arbitration / share
 * lifecycle / title sync. Global Observable streams use shareReplay(1) so the
 * MultiplayerControl popover + TitleSync controller don't open redundant tRPC
 * subscriptions for the same datastream.
 */
export class SharedSessionService extends Disposable implements ISharedSessionService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().sharedSession;
  }

  readonly sessions$: Observable<readonly ISharedSession[]> = trpcSubscriptionToObservable<readonly ISharedSession[]>(
    (opts) => this._client.sessions$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async listSessions(): Promise<readonly ISharedSession[]> {
    return this._client.listSessions.query() as Promise<readonly ISharedSession[]>;
  }

  participants$(sessionId: string): Observable<readonly IParticipant[]> {
    return trpcSubscriptionToObservable<readonly IParticipant[]>(
      (opts) => this._client.participants$.subscribe(sessionId, opts)
    );
  }

  driverState$(sessionId: string): Observable<IDriverState> {
    return trpcSubscriptionToObservable<IDriverState>(
      (opts) => this._client.driverState$.subscribe(sessionId, opts)
    );
  }

  async setDriver(sessionId: string, clientId: string | null): Promise<void> {
    await this._client.setDriver.mutate({ sessionId, clientId });
  }

  async lockDriver(sessionId: string, clientId: string): Promise<void> {
    await this._client.lockDriver.mutate({ sessionId, clientId });
  }

  async unlockDriver(sessionId: string): Promise<void> {
    await this._client.unlockDriver.mutate(sessionId);
  }

  async kick(sessionId: string, clientId: string, reason?: string): Promise<void> {
    await this._client.kick.mutate({ sessionId, clientId, reason });
  }

  readonly shareable$: Observable<readonly IShareableSession[]> = trpcSubscriptionToObservable<readonly IShareableSession[]>(
    (opts) => this._client.shareable$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async listShareable(): Promise<readonly IShareableSession[]> {
    return this._client.listShareable.query() as Promise<readonly IShareableSession[]>;
  }

  async shareSshSession(sessionId: string, options?: IShareSessionOptions): Promise<void> {
    await this._client.shareSshSession.mutate({ sessionId, inputPolicy: options?.inputPolicy });
  }

  async sharePtySession(sessionId: string, options?: IShareSessionOptions): Promise<void> {
    await this._client.sharePtySession.mutate({ sessionId, inputPolicy: options?.inputPolicy });
  }

  async stopSharing(sessionId: string): Promise<void> {
    await this._client.stopSharing.mutate(sessionId);
  }

  async setSessionTitle(sessionId: string, title: string): Promise<void> {
    await this._client.setSessionTitle.mutate({ sessionId, title });
  }
}
