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

import type { Dependency, Injector } from '@termlnk/core';
import type { ISyncCorePluginConfig } from './controllers/config.schema';
import { ITokenManager } from '@termlnk/auth';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { DependentOn, IConfigService, ILogService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { IBackupService, ISyncCryptoService, ISyncOutboxService, ISyncService, ISyncTransportService, SyncPlugin } from '@termlnk/sync';
import { BackupService, ConfigSynchroniser, HostSynchroniser, HttpSyncTransportService, IdentitySynchroniser, KnownHostSynchroniser, McpSynchroniser, NoopSyncTransportService, ProviderSynchroniser, SkillSynchroniser, SshKeySynchroniser, SyncCryptoService, SyncOutboxService, SyncService } from '@termlnk/sync-engine';
import { AuthSyncBridgeController } from './controllers/auth-sync-bridge.controller';
import { defaultPluginConfig, SYNC_CORE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { SynchroniserRegistrationController } from './controllers/synchroniser-registration.controller';

export const SYNC_CORE_PLUGIN_NAME = 'SYNC_CORE_PLUGIN';

@DependentOn(DatabasePlugin, AuthCorePlugin, SyncPlugin)
export class SyncCorePlugin extends Plugin {
  static override pluginName = SYNC_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: ISyncCorePluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(SYNC_CORE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const transportBinding = this._config.cloudBaseUrl
      ? this._buildHttpTransportBinding(this._config.cloudBaseUrl)
      : ([ISyncTransportService, { useClass: NoopSyncTransportService }] as Dependency);

    const dependencies: Dependency[] = [
      [ISyncCryptoService, { useClass: SyncCryptoService }],
      [ISyncOutboxService, { useClass: SyncOutboxService }],
      [IBackupService, { useClass: BackupService }],
      [ISyncService, { useClass: SyncService }],
      transportBinding,

      [HostSynchroniser, { useClass: HostSynchroniser }],
      [ConfigSynchroniser, { useClass: ConfigSynchroniser }],
      [ProviderSynchroniser, { useClass: ProviderSynchroniser }],
      [McpSynchroniser, { useClass: McpSynchroniser }],
      [SkillSynchroniser, { useClass: SkillSynchroniser }],
      [SshKeySynchroniser, { useClass: SshKeySynchroniser }],
      [IdentitySynchroniser, { useClass: IdentitySynchroniser }],
      [KnownHostSynchroniser, { useClass: KnownHostSynchroniser }],

      [SynchroniserRegistrationController],
      [AuthSyncBridgeController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  private _buildHttpTransportBinding(baseUrl: string): Dependency {
    return [ISyncTransportService, {
      useFactory: (tokenManager: ITokenManager, logService: ILogService) =>
        new HttpSyncTransportService({ baseUrl }, tokenManager, logService),
      deps: [ITokenManager, ILogService],
    }];
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [AuthSyncBridgeController],
      [SynchroniserRegistrationController],
    ]);
  }
}
