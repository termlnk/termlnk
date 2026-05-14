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

import type { IPokeMessage, IPullRequest, IPullResponse, IPushRequest, IPushResponse, ISyncTransportService } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Placeholder transport — stays "disconnected"; push/pull throw.
 *
 * Used when no cloud backend is configured. `SyncCorePlugin` always binds a
 * transport so `SyncService.enable()` works (instead of failing DI). After
 * `enable()` the service immediately enters Offline; once the user logs in or
 * configures a backend, desktop main overrides this with the real HTTP/WS
 * implementation.
 */
export class NoopSyncTransportService extends Disposable implements ISyncTransportService {
  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _poke$ = new Subject<IPokeMessage>();
  readonly poke$: Observable<IPokeMessage> = this._poke$.asObservable();

  override dispose(): void {
    this._connected$.complete();
    this._poke$.complete();
    super.dispose();
  }

  async push(_req: IPushRequest): Promise<IPushResponse> {
    throw new Error('[NoopSyncTransportService] cloud transport is not configured; sync push is unavailable');
  }

  async pull(_req: IPullRequest): Promise<IPullResponse> {
    throw new Error('[NoopSyncTransportService] cloud transport is not configured; sync pull is unavailable');
  }

  async connect(): Promise<void> {
    // No error, but stay disconnected so `SyncService` enters Offline.
  }

  async disconnect(): Promise<void> {
    this._connected$.next(false);
  }
}
