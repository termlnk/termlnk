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

import type { IMasterKeyService } from '@termlnk/auth';
import type { ILogService } from '@termlnk/core';
import type { ISyncService, SyncState } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type { IMobileHost } from '../storage/types';
import { IMasterKeyService as IMasterKeyServiceId } from '@termlnk/auth';
import { createIdentifier, Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { ISyncService as ISyncServiceId } from '@termlnk/sync';
import { HostSynchroniser } from '@termlnk/sync-engine';
import { IMobileHostRepository } from '../storage/mobile-host-repository';

// Renderer-facing facade over the shared @termlnk/sync-engine coordinator. It registers the
// mobile synchronisers, exposes the host list the screens render, and offers a single
// `pull()` entry point: the first call enables the engine (opens the poke WebSocket, runs
// the initial reconcile pull, and arms the push loop); later calls trigger an immediate
// push+pull. The engine writes pulled rows straight into MobileHostRepository, so `hosts$`
// stays the single source of truth the UI already subscribes to.
export interface IMobileSyncService {
  readonly hosts$: Observable<readonly IMobileHost[]>;
  readonly state$: Observable<SyncState>;
  pull(): Promise<void>;
}

export const IMobileSyncService = createIdentifier<IMobileSyncService>('mobile.sync.service');

export class MobileSyncService extends Disposable implements IMobileSyncService {
  readonly hosts$: Observable<readonly IMobileHost[]>;
  readonly state$: Observable<SyncState>;

  private _enabled = false;

  // Field-declaration + body-assignment form avoids parameter-property syntax, which
  // babel-plugin-parameter-decorator cannot pair with parameter decorators.
  private readonly _syncService: ISyncService;
  private readonly _hostRepo: IMobileHostRepository;
  private readonly _masterKeyService: IMasterKeyService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(ISyncServiceId) syncService: ISyncService,
    @Inject(IMobileHostRepository) hostRepo: IMobileHostRepository,
    @Inject(HostSynchroniser) hostSynchroniser: HostSynchroniser,
    @Inject(IMasterKeyServiceId) masterKeyService: IMasterKeyService,
    @Inject(ILogServiceId) logService: ILogService
  ) {
    super();
    this._syncService = syncService;
    this._hostRepo = hostRepo;
    this._masterKeyService = masterKeyService;
    this._logService = logService;
    this.hosts$ = hostRepo.hosts$;
    this.state$ = syncService.state$;

    // Register the host synchroniser with the engine; the returned disposable unregisters
    // it on teardown. ssh_key / identity / known_host synchronisers join in Phase 3.
    this.disposeWithMe(syncService.register(hostSynchroniser));

    // Surface persisted hosts before the first pull resolves.
    void hostRepo.ready().catch((err) => {
      this._logService.warn('[MobileSyncService] host repo ready failed:', err);
    });
  }

  async pull(): Promise<void> {
    if (!this._masterKeyService.getCurrent()) {
      throw new Error('[MobileSyncService] master key is locked — sign in first');
    }
    if (!this._enabled) {
      this._enabled = true;
      await this._syncService.enable();
      return;
    }
    await this._syncService.syncNow();
  }
}
