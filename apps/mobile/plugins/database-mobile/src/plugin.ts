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

import type { Dependency } from '@termlnk/core';
import type { IDatabaseMobileConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { IHostSyncRepository, IIdentitySyncRepository, IKnownHostSyncRepository, IPortForwardingRuleSyncRepository, ISshKeySyncRepository, ISyncConfigRepository, ISyncCursorRepository, ISyncFieldMetaRepository, ISyncOutboxRepository, ISyncRowMetaRepository } from '@termlnk/sync';
import { DATABASE_MOBILE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { ExpoSqliteAdaptor, IDatabaseMobileAdaptorService } from './services/expo-sqlite-adaptor.service';
import { IMobileHostRepository, MobileHostRepository } from './services/mobile-host-repository';
import { IMobileIdentityRepository, IMobileKnownHostRepository, IMobileSshKeyRepository, MobileIdentityRepository, MobileKnownHostRepository, MobileSshKeyRepository } from './services/mobile-keychain-repositories';
import { IMobilePreferencesService, MobilePreferencesService } from './services/mobile-preferences.service';
import { IMobilePortForwardingRuleRepository, MobilePortForwardingRuleRepository } from './services/mobile-port-forwarding-rule-repository';
import { IMobileSecretCipherService, MobileSecretCipherService } from './services/mobile-secret-cipher.service';
import { MobileSyncConfigRepository, MobileSyncCursorRepository, MobileSyncFieldMetaRepository, MobileSyncOutboxRepository, MobileSyncRowMetaRepository } from './services/mobile-sync-repositories';
import { IRecentSessionsRepository, RecentSessionsRepository } from './services/recent-sessions-repository';

export const DATABASE_MOBILE_PLUGIN_NAME = 'DATABASE_MOBILE_PLUGIN';

export class DatabaseMobilePlugin extends Plugin {
  static override pluginName = DATABASE_MOBILE_PLUGIN_NAME;

  constructor(
    private readonly _config: IDatabaseMobileConfig = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(DATABASE_MOBILE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      // Adaptor + cipher
      [IDatabaseMobileAdaptorService, { useClass: ExpoSqliteAdaptor }],
      [IMobileSecretCipherService, { useClass: MobileSecretCipherService }],

      // Domain repos (mirror storage-mobile's public contract)
      [IMobileHostRepository, { useClass: MobileHostRepository }],
      [IMobileIdentityRepository, { useClass: MobileIdentityRepository }],
      [IMobileSshKeyRepository, { useClass: MobileSshKeyRepository }],
      [IMobileKnownHostRepository, { useClass: MobileKnownHostRepository }],
      [IRecentSessionsRepository, { useClass: RecentSessionsRepository }],
      [IMobilePortForwardingRuleRepository, { useClass: MobilePortForwardingRuleRepository }],
      [IMobilePreferencesService, { useClass: MobilePreferencesService }],

      // Sync engine bookkeeping repos (moved here from sync-mobile)
      [ISyncOutboxRepository, { useClass: MobileSyncOutboxRepository }],
      [ISyncRowMetaRepository, { useClass: MobileSyncRowMetaRepository }],
      [ISyncFieldMetaRepository, { useClass: MobileSyncFieldMetaRepository }],
      [ISyncCursorRepository, { useClass: MobileSyncCursorRepository }],
      [ISyncConfigRepository, { useClass: MobileSyncConfigRepository }],

      // Sync-engine resource repo aliases: the engine injects platform-agnostic interface
      // tokens (IHostSyncRepository etc.); a single concrete class backs both tokens.
      [IHostSyncRepository, { useExisting: IMobileHostRepository }],
      [IIdentitySyncRepository, { useExisting: IMobileIdentityRepository }],
      [ISshKeySyncRepository, { useExisting: IMobileSshKeyRepository }],
      [IKnownHostSyncRepository, { useExisting: IMobileKnownHostRepository }],
      [IPortForwardingRuleSyncRepository, { useExisting: IMobilePortForwardingRuleRepository }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
