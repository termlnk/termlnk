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
import type { ISyncMobileConfig } from './controllers/config.schema';
import { ITokenManager as ITokenManagerId } from '@termlnk/auth';
import { IConfigService, ILogService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IBackupService, ISyncCryptoService, ISyncOutboxService, ISyncService, ISyncTransportService } from '@termlnk/sync';
import { BackupService, HostSynchroniser, HttpSyncTransportService, IdentitySynchroniser, KnownHostSynchroniser, NoopSyncTransportService, PortForwardingRuleSynchroniser, ProviderSynchroniser, SnippetSynchroniser, SshKeySynchroniser, SyncCryptoService, SyncOutboxService, SyncService } from '@termlnk/sync-engine';
import { defaultPluginConfig, SYNC_MOBILE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { MobileAuthSyncBridgeController } from './controllers/mobile-auth-sync-bridge.controller';
import { IMobileSyncService, MobileSyncService } from './services/mobile-sync.service';

export const SYNC_MOBILE_PLUGIN_NAME = 'SYNC_MOBILE_PLUGIN';

export class SyncMobilePlugin extends Plugin {
  static override pluginName = SYNC_MOBILE_PLUGIN_NAME;

  // Fields are declared and assigned explicitly rather than via TS parameter
  // properties: the mobile Babel pipeline cannot combine a parameter decorator
  // with a parameter property (see apps/mobile/babel.config.js), so a decorated
  // constructor param must be a plain identifier with an explicit `this._x = x`.
  protected readonly _injector: Injector;
  private readonly _config: ISyncMobileConfig;
  private readonly _configService: IConfigService;

  constructor(
    config: ISyncMobileConfig = defaultPluginConfig,
    @InjectSelf() injector: Injector,
    @IConfigService configService: IConfigService
  ) {
    super();
    this._injector = injector;
    this._configService = configService;
    this._config = config;
    this._configService.setConfig(SYNC_MOBILE_PLUGIN_CONFIG_KEY, merge({}, defaultPluginConfig, config));
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
      [PortForwardingRuleSynchroniser, { useClass: PortForwardingRuleSynchroniser }],
      [SnippetSynchroniser, { useClass: SnippetSynchroniser }],
      [ProviderSynchroniser, { useClass: ProviderSynchroniser }],
      [IMobileSyncService, { useClass: MobileSyncService }],
      [MobileAuthSyncBridgeController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    // IMobileSyncService first so its constructor registers the resource synchronisers with
    // the engine before the bridge can fire an auth-driven pull(). The bridge then wires the
    // auth/master-key streams to enable/stop the runtime automatically.
    touchDependencies(this._injector, [[IMobileSyncService], [MobileAuthSyncBridgeController]]);
  }
}
