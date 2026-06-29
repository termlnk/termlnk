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
import type { IMobileHost } from '@termlnk/database-mobile';
import type { ISyncService, SyncState } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { IMasterKeyService as IMasterKeyServiceId } from '@termlnk/auth';
import { createIdentifier, Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { IMobileHostRepository } from '@termlnk/database-mobile';
import { ISyncService as ISyncServiceId } from '@termlnk/sync';
import { HostSynchroniser, IdentitySynchroniser, KnownHostSynchroniser, PortForwardingRuleSynchroniser, ProviderSynchroniser, SnippetSynchroniser, SshKeySynchroniser } from '@termlnk/sync-engine';

export interface IMobileSyncService {
  readonly hosts$: Observable<readonly IMobileHost[]>;
  readonly state$: Observable<SyncState>;
  pull(): Promise<void>;
  stop(): Promise<void>;
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
    @Inject(IdentitySynchroniser) identitySynchroniser: IdentitySynchroniser,
    @Inject(SshKeySynchroniser) sshKeySynchroniser: SshKeySynchroniser,
    @Inject(KnownHostSynchroniser) knownHostSynchroniser: KnownHostSynchroniser,
    @Inject(PortForwardingRuleSynchroniser) portForwardingRuleSynchroniser: PortForwardingRuleSynchroniser,
    @Inject(SnippetSynchroniser) snippetSynchroniser: SnippetSynchroniser,
    @Inject(ProviderSynchroniser) providerSynchroniser: ProviderSynchroniser,
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

    // Register every resource synchroniser with the engine; the returned disposables
    // unregister them on teardown.
    this.disposeWithMe(syncService.register(hostSynchroniser));
    this.disposeWithMe(syncService.register(identitySynchroniser));
    this.disposeWithMe(syncService.register(sshKeySynchroniser));
    this.disposeWithMe(syncService.register(knownHostSynchroniser));
    this.disposeWithMe(syncService.register(portForwardingRuleSynchroniser));
    this.disposeWithMe(syncService.register(snippetSynchroniser));
    this.disposeWithMe(syncService.register(providerSynchroniser));

    // Surface persisted hosts before the first pull resolves.
    void hostRepo.ready().catch((err) => {
      this._logService.warn('[MobileSyncService] host repo ready failed:', err);
    });
  }

  async pull(): Promise<void> {
    if (!this._masterKeyService.getCurrent()) {
      this._logService.debug('[MobileSyncService] pull skipped — master key not available');
      return;
    }
    if (!this._enabled) {
      // Only latch _enabled after enable() resolves; if it throws (transient reconcile /
      // transport failure) the next pull() retries enable() instead of stalling on syncNow.
      await this._syncService.enable();
      this._enabled = true;
      return;
    }
    await this._syncService.syncNow();
  }

  async stop(): Promise<void> {
    // Idempotent: only tear down a runtime we actually started. stopRuntime() pauses the
    // poke socket + push loop without flipping persisted userEnabled, so a later pull()
    // re-enables from scratch (sign-out / idle-lock both route here via the auth bridge).
    if (!this._enabled) {
      return;
    }
    this._enabled = false;
    await this._syncService.stopRuntime();
  }
}
