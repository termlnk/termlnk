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

import type { IAuthKeyValueStorage as IAuthKeyValueStorageType, IDeviceNameProvider as IDeviceNameProviderType, IMasterKeyService as IMasterKeyServiceType, ISrpClientService as ISrpClientServiceType, IUserStorageService as IUserStorageServiceType } from '@termlnk/auth';
import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { AuthPlugin, IAuthKeyValueStorage, IAuthService, IDeviceNameProvider, IIdleProbe, IMasterKeyService, IPasswordHasher, ISrpClientService, ITokenRefresher, ITokenStorageService, IUserStorageService } from '@termlnk/auth';
import { DependentOn, ILogService, InjectSelf, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
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

export interface IAuthCorePluginConfig {
  // Cloud root with version prefix (e.g. `https://cloud.termlnk.io/v1`). When set, IAuthService
  // and ITokenRefresher are bound to their HTTP implementations. When unset, both stay
  // unbound; consumers using Quantity.OPTIONAL receive null and the UI shows a placeholder.
  cloudBaseUrl?: string;

  override?: DependencyOverride;
}

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
      [IUserStorageService, { useClass: UserStorageService }],
      [TokenManager, { useClass: TokenManager }],
      // WebAssembly-backed Argon2id. React Native/Hermes lacks WebAssembly support and
      // must override this with a native binding (see apps/mobile MobilePlatformPlugin).
      [IPasswordHasher, { useClass: HashWasmPasswordHasher }],
      // Platform-agnostic fallback (returns 'Unknown device'). Each app overrides this
      // from its own platform/ layer (apps/desktop/main, apps/web/server, apps/mobile).
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
            storage: IAuthKeyValueStorageType,
            userStorage: IUserStorageServiceType,
            logService: ILogService,
            deviceNameProvider: IDeviceNameProviderType
          ) => new HttpAuthService(
            { baseUrl },
            masterKey,
            srp,
            tokenManager,
            storage,
            userStorage,
            logService,
            deviceNameProvider
          ),
          deps: [IMasterKeyService, ISrpClientService, TokenManager, IAuthKeyValueStorage, IUserStorageService, ILogService, IDeviceNameProvider],
        }]
      );
    }

    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [IdleLockController],
    ]);

    // Restore currentUser$/authState$ from the locally persisted token + user pair so
    // a restart does not bounce the user back to the login screen. Only when an
    // IAuthService implementation is bound (i.e. cloudBaseUrl was configured) — without
    // it there is nothing to restore and no UI consumer to receive the emit. Fire and
    // forget: restore() is internally fail-soft and never throws.
    const authService = this._injector.get(IAuthService, Quantity.OPTIONAL);
    if (authService) {
      void authService.restore();
    }
  }
}
