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

import type { IAuthKeyValueStorage as IAuthKeyValueStorageType, IDeviceNameProvider as IDeviceNameProviderType, IMasterKeyService as IMasterKeyServiceType, ISrpClientService as ISrpClientServiceType, ITokenManager as ITokenManagerType, IUserStorageService as IUserStorageServiceType } from '@termlnk/auth';
import type { Dependency, Injector } from '@termlnk/core';
import type { IAuthCorePluginConfig } from './controllers/config.schema';
import { AuthPlugin, IAuthKeyValueStorage, IAuthService, IDeviceNameProvider, IIdleProbe, IMasterKeyService, IPasswordHasher, ISrpClientService, ITokenManager, ITokenRefresher, ITokenStorageService, IUserStorageService } from '@termlnk/auth';
import { DependentOn, IConfigService, ILogService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
import { AUTH_CORE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { IdleLockController } from './controllers/idle-lock.controller';
import { DefaultDeviceNameProvider } from './services/default-device-name-provider.service';
import { HashWasmPasswordHasher } from './services/hash-wasm-password-hasher.service';
import { HttpAuthService } from './services/http-auth.service';
import { HttpTokenRefresher } from './services/http-token-refresher.service';
import { NoopIdleProbe } from './services/idle-probe.service';
import { MasterKeyService } from './services/master-key.service';
import { SrpClientService } from './services/srp-client.service';
import { TokenManager } from './services/token-manager.service';
import { TokenStorageService } from './services/token-storage.service';
import { UserStorageService } from './services/user-storage.service';

export const AUTH_CORE_PLUGIN_NAME = 'AUTH_CORE_PLUGIN';

@DependentOn(AuthPlugin)
export class AuthCorePlugin extends Plugin {
  static override pluginName = AUTH_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthCorePluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(AUTH_CORE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [IdleLockController],
    ]);

    const authService = this._injector.get(IAuthService, Quantity.OPTIONAL);
    if (authService) {
      void authService.restore().catch((err) => {
        this._injector.get(ILogService).error('[AuthCorePlugin] auth restore failed:', err);
      });
    }
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [IMasterKeyService, { useClass: MasterKeyService }],
      [ISrpClientService, { useClass: SrpClientService }],
      [ITokenStorageService, { useClass: TokenStorageService }],
      [IUserStorageService, { useClass: UserStorageService }],
      [ITokenManager, { useClass: TokenManager }],
      [IPasswordHasher, { useClass: HashWasmPasswordHasher }],
      [IDeviceNameProvider, { useClass: DefaultDeviceNameProvider }],
      [IIdleProbe, { useClass: NoopIdleProbe }],
      [IdleLockController],
    ];

    if (this._config.cloudBaseUrl) {
      const baseUrl = this._config.cloudBaseUrl;
      dependencies.push(
        [ITokenRefresher, {
          // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
          useFactory: (logService: ILogService) => new HttpTokenRefresher({ baseUrl }, logService),
          deps: [ILogService],
        }],
        [IAuthService, {
          // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
          useFactory: (masterKey: IMasterKeyServiceType, srp: ISrpClientServiceType, tokenManager: ITokenManagerType, storage: IAuthKeyValueStorageType, userStorage: IUserStorageServiceType, logService: ILogService, deviceNameProvider: IDeviceNameProviderType) =>
            new HttpAuthService(
              { baseUrl },
              masterKey,
              srp,
              tokenManager,
              storage,
              userStorage,
              logService,
              deviceNameProvider
            ),
          deps: [IMasterKeyService, ISrpClientService, ITokenManager, IAuthKeyValueStorage, IUserStorageService, ILogService, IDeviceNameProvider],
        }]
      );
    }

    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
