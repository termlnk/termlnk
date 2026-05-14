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

import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { AuthCorePlugin } from '@termlnk/auth-core';
// Deep import keeps TokenManager from being resolved through the package barrel — that
// path drags @termlnk/database into the type graph and produces a second nominal
// TokenManager when http-transport.service.ts also deep-imports it. Both call sites
// must share one resolution path or TS treats them as incompatible classes.
import { TokenManager } from '@termlnk/auth-core/services/token-manager.service.ts';
import { DependentOn, ILogService, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { IBackupService, ISyncCryptoService, ISyncOutboxService, ISyncService, ISyncTransportService, SyncPlugin } from '@termlnk/sync';
import { AuthSyncBridgeController } from './controllers/auth-sync-bridge.controller';
import { SynchroniserRegistrationController } from './controllers/synchroniser-registration.controller';
import { BackupService } from './services/backup.service';
import { SyncCryptoService } from './services/crypto.service';
import { HttpSyncTransportService } from './services/http-transport.service';
import { NoopSyncTransportService } from './services/noop-transport.service';
import { SyncOutboxService } from './services/outbox.service';
import { SyncService } from './services/sync.service';
import { ConfigSynchroniser } from './synchronisers/config-synchroniser';
import { HostSynchroniser } from './synchronisers/host-synchroniser';
import { McpSynchroniser } from './synchronisers/mcp-synchroniser';
import { ProviderSynchroniser } from './synchronisers/provider-synchroniser';
import { SkillSynchroniser } from './synchronisers/skill-synchroniser';

export const SYNC_CORE_PLUGIN_NAME = 'SYNC_CORE_PLUGIN';

export interface ISyncCorePluginConfig {
  // Cloud root with version prefix (e.g. `https://cloud.termlnk.io/v1`). When set the
  // HTTP transport replaces the default Noop binding. With no URL, SyncService.enable()
  // immediately transitions to Offline; backup / import still work because they do not
  // depend on the network.
  cloudBaseUrl?: string;

  // Override path; lets desktop-main swap the transport without going through cloudBaseUrl.
  override?: DependencyOverride;
}

@DependentOn(DatabasePlugin, AuthCorePlugin, SyncPlugin)
export class SyncCorePlugin extends Plugin {
  static override pluginName = SYNC_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: ISyncCorePluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
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

      // SynchroniserRegistrationController injects the concrete SyncService class, so we
      // bind the same instance under both the interface token and the concrete token.
      [SyncService, { useClass: SyncService }],

      [HostSynchroniser, { useClass: HostSynchroniser }],
      [ConfigSynchroniser, { useClass: ConfigSynchroniser }],
      [ProviderSynchroniser, { useClass: ProviderSynchroniser }],
      [McpSynchroniser, { useClass: McpSynchroniser }],
      [SkillSynchroniser, { useClass: SkillSynchroniser }],

      [SynchroniserRegistrationController],
      [AuthSyncBridgeController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  private _buildHttpTransportBinding(baseUrl: string): Dependency {
    return [ISyncTransportService, {
      // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
      useFactory: (
        tokenManager: TokenManager,
        logService: ILogService
      ) => new HttpSyncTransportService(
        { baseUrl },
        tokenManager,
        logService
      ),
      deps: [TokenManager, ILogService],
    }];
  }

  override onReady(): void {
    // Touch the registration + bridge controllers: the former wires synchronisers into
    // SyncService, the latter subscribes to IAuthService.authState$.
    touchDependencies(this._injector, [
      [AuthSyncBridgeController],
      [SynchroniserRegistrationController],
    ]);
  }
}
