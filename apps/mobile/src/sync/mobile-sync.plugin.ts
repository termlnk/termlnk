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

import type { ITokenManager } from '@termlnk/auth';
import type { Dependency, Injector } from '@termlnk/core';
import { ITokenManager as ITokenManagerId } from '@termlnk/auth';
import { ILogService, InjectSelf, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IBackupService, ISyncCryptoService, ISyncOutboxService, ISyncService, ISyncTransportService } from '@termlnk/sync';
import {
  BackupService,
  HostSynchroniser,
  HttpSyncTransportService,
  IdentitySynchroniser,
  KnownHostSynchroniser,
  NoopSyncTransportService,
  SshKeySynchroniser,
  SyncCryptoService,
  SyncOutboxService,
  SyncService,
} from '@termlnk/sync-engine';
import { IMobileSyncService, MobileSyncService } from '../sync/mobile-sync.service';

export const MOBILE_SYNC_PLUGIN_NAME = 'MOBILE_SYNC_PLUGIN';

export interface IMobileSyncPluginConfig {
  // Cloud root with version prefix; when absent the transport stays a no-op and sync is
  // effectively disabled (the local vault still renders from persisted rows).
  readonly cloudBaseUrl: string | undefined;
}

// Wires the shared @termlnk/sync-engine into the React Native runtime. The repository
// contracts the engine injects (ISyncOutboxRepository, IHostSyncRepository, …) are bound by
// MobilePlatformPlugin against expo-sqlite; this plugin binds the engine services and the
// renderer-facing MobileSyncService facade. No @DependentOn: mobile relies on registration
// order (MobilePlatformPlugin + AuthCorePlugin come first) plus redi's lazy resolution.
export class MobileSyncPlugin extends Plugin {
  static override pluginName = MOBILE_SYNC_PLUGIN_NAME;

  protected readonly _injector: Injector;
  private readonly _config: IMobileSyncPluginConfig;

  constructor(
    config: IMobileSyncPluginConfig,
    @InjectSelf() injector: Injector
  ) {
    super();
    this._config = config;
    this._injector = injector;
  }

  override onStarting(): void {
    const cloudBaseUrl = this._config.cloudBaseUrl;
    const transportBinding: Dependency = cloudBaseUrl
      ? [ISyncTransportService, {
          useFactory: (tokenManager: ITokenManager, logService: ILogService) =>
            new HttpSyncTransportService({ baseUrl: cloudBaseUrl }, tokenManager, logService),
          deps: [ITokenManagerId, ILogService],
        }]
      : [ISyncTransportService, { useClass: NoopSyncTransportService }];

    const dependencies: Dependency[] = [
      [ISyncCryptoService, { useClass: SyncCryptoService }],
      [ISyncOutboxService, { useClass: SyncOutboxService }],
      [IBackupService, { useClass: BackupService }],
      [ISyncService, { useClass: SyncService }],
      transportBinding,
      [HostSynchroniser, { useClass: HostSynchroniser }],
      [IdentitySynchroniser, { useClass: IdentitySynchroniser }],
      [SshKeySynchroniser, { useClass: SshKeySynchroniser }],
      [KnownHostSynchroniser, { useClass: KnownHostSynchroniser }],
      [IMobileSyncService, { useClass: MobileSyncService }],
    ];
    registerDependencies(this._injector, dependencies);
  }

  override onReady(): void {
    // Construct MobileSyncService now so it registers the host synchroniser with the engine
    // before any screen calls pull().
    touchDependencies(this._injector, [[IMobileSyncService]]);
  }
}
