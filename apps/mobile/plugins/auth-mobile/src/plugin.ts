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
import type { IAuthMobileConfig } from './controllers/config.schema';
import { IAuthKeyValueStorage, IPasswordHasher } from '@termlnk/auth';
import { IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { AUTH_MOBILE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { BiometricService, IBiometricService } from './services/biometric.service';
import { ExpoSecureStoreAuthKeyValueStorage } from './services/expo-secure-store-auth-key-value-storage.service';
import { LibsodiumPasswordHasher } from './services/libsodium-password-hasher.service';
import { IPinStoreService, PinStoreService } from './services/pin-store.service';

export const AUTH_MOBILE_PLUGIN_NAME = 'AUTH_MOBILE_PLUGIN';

export class AuthMobilePlugin extends Plugin {
  static override pluginName = AUTH_MOBILE_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthMobileConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(AUTH_MOBILE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IAuthKeyValueStorage, { useClass: ExpoSecureStoreAuthKeyValueStorage }],
      [IPasswordHasher, { useClass: LibsodiumPasswordHasher }],
      [IBiometricService, { useClass: BiometricService }],
      [IPinStoreService, { useClass: PinStoreService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
