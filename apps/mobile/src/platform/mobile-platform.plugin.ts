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
import { IAuthKeyValueStorage, IDeviceNameProvider } from '@termlnk/auth';
import { InjectSelf, Plugin, registerDependencies } from '@termlnk/core';
import { ExpoDeviceNameProvider } from './expo-device-name-provider.service';
import { ExpoSecureStoreAuthKeyValueStorage } from './expo-secure-store-auth-key-value-storage.service';

export const MOBILE_PLATFORM_PLUGIN_NAME = 'MOBILE_PLATFORM_PLUGIN';

// React Native equivalent of DatabasePlugin's platform-binding responsibilities. Must
// be registered BEFORE AuthCorePlugin so the OS keystore / device-name bindings are
// available when TokenStorageService asks for them. The Electron main process gets the
// same bindings through DatabasePlugin (ConfigRepository + SafeStorage) + an
// OsHostnameDeviceNameProvider override — the contracts are platform-symmetric.
export class MobilePlatformPlugin extends Plugin {
  static override pluginName = MOBILE_PLATFORM_PLUGIN_NAME;

  constructor(
    _config: undefined = undefined,
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IAuthKeyValueStorage, { useClass: ExpoSecureStoreAuthKeyValueStorage }],
      [IDeviceNameProvider, { useClass: ExpoDeviceNameProvider }],
    ];
    registerDependencies(this._injector, dependencies);
  }
}
