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

import type { IDeviceNameProvider as IDeviceNameProviderType, IMasterKeyService as IMasterKeyServiceType, ISrpClientService as ISrpClientServiceType } from '@termlnk/auth';
import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { AuthPlugin, IAuthService, IDeviceNameProvider, IIdleProbe, IMasterKeyService, ISrpClientService, ITokenRefresher, ITokenStorageService } from '@termlnk/auth';
import { DependentOn, ILogService, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IdleLockController } from './controllers/idle-lock.controller';
import { DefaultDeviceNameProvider } from './services/default-device-name-provider.service';
import { HttpAuthService } from './services/http-auth.service';
import { HttpTokenRefresher } from './services/http-token-refresher.service';
import { NoopIdleProbe } from './services/idle-probe.service';
import { MasterKeyService } from './services/master-key.service';
import { SrpClientService } from './services/srp-client.service';
import { TokenManager } from './services/token-manager.service';
import { TokenStorageService } from './services/token-storage.service';

export const AUTH_CORE_PLUGIN_NAME = 'AUTH_CORE_PLUGIN';

export interface IAuthCorePluginConfig {
  // Cloud root with version prefix (e.g. `https://cloud.termlnk.io/v1`). When set, IAuthService
  // and ITokenRefresher are bound to their HTTP implementations. When unset, both stay
  // unbound; consumers using Quantity.OPTIONAL receive null and the UI shows a placeholder.
  cloudBaseUrl?: string;

  override?: DependencyOverride;
}

// IAuthKeyValueStorage is the only host-platform contract this plugin requires the
// caller to bind in advance (Electron main / web server bind a SQLite-backed adapter
// via DatabasePlugin; React Native binds an expo-secure-store adapter). Auth-core does
// not @DependentOn DatabasePlugin so the package stays free of native-binding deps.
@DependentOn(AuthPlugin)
export class AuthCorePlugin extends Plugin {
  static override pluginName = AUTH_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthCorePluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IMasterKeyService, { useClass: MasterKeyService }],
      [ISrpClientService, { useClass: SrpClientService }],
      [ITokenStorageService, { useClass: TokenStorageService }],
      [TokenManager, { useClass: TokenManager }],
      // Platform-agnostic fallback (returns 'Unknown device'). Electron main injects
      // OsHostnameDeviceNameProvider via override; mobile injects ExpoDeviceNameProvider.
      [IDeviceNameProvider, { useClass: DefaultDeviceNameProvider }],
      // Safe default for non-Electron contexts; ElectronMainPlugin overrides with a
      // powerMonitor-backed implementation.
      [IIdleProbe, { useClass: NoopIdleProbe }],
      // No public interface; onReady touches it so the constructor wires up subscriptions.
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
          useFactory: (
            masterKey: IMasterKeyServiceType,
            srp: ISrpClientServiceType,
            tokenManager: TokenManager,
            logService: ILogService,
            deviceNameProvider: IDeviceNameProviderType
          ) => new HttpAuthService(
            { baseUrl },
            masterKey,
            srp,
            tokenManager,
            logService,
            deviceNameProvider
          ),
          deps: [IMasterKeyService, ISrpClientService, TokenManager, ILogService, IDeviceNameProvider],
        }]
      );
    }

    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    // Force IdleLockController to instantiate so its constructor can subscribe to
    // IMasterKeyService.state$. onStarting is too early — the service is not yet bound.
    touchDependencies(this._injector, [
      [IdleLockController],
    ]);
  }
}
