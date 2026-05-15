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
import { IAuthKeyValueStorage } from '@termlnk/auth';
import { InjectSelf, Plugin, registerDependencies } from '@termlnk/core';
import { IMobileHostRepository, MobileHostRepository } from '../storage/mobile-host-repository';
import { IMobileSecretCipherService, MobileSecretCipherService } from '../storage/mobile-secret-cipher.service';
import { IMobileSqliteDatabaseService, MobileSqliteDatabaseService } from '../storage/mobile-sqlite-database.service';
import { ExpoSecureStoreAuthKeyValueStorage } from './expo-secure-store-auth-key-value-storage.service';

export const MOBILE_PLATFORM_PLUGIN_NAME = 'MOBILE_PLATFORM_PLUGIN';

// React Native equivalent of DatabasePlugin's platform-binding responsibilities. Binds
// only the contracts that auth-core does NOT ship with a default — currently just the
// OS keystore. Identifiers that auth-core already binds a default for (IIdleProbe,
// IDeviceNameProvider) must be passed through AuthCorePlugin's `override` so redi
// replaces the default binding instead of accumulating a second one (which trips
// "Expect 1 dependency item(s) ... but get 2" at injection time).
//
// Constructor avoids the `@InjectSelf() protected readonly _injector` parameter-property
// form on purpose: babel-plugin-parameter-decorator cannot keep param decorators paired
// with TypeScript parameter properties (see apps/mobile/babel.config.js comment). Split
// into a plain decorated parameter + explicit field assignment so the decorator survives
// Babel's TS strip pass.
export class MobilePlatformPlugin extends Plugin {
  static override pluginName = MOBILE_PLATFORM_PLUGIN_NAME;

  protected readonly _injector: Injector;

  constructor(
    _config: undefined = undefined,
    @InjectSelf() injector: Injector
  ) {
    super();
    this._injector = injector;
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IAuthKeyValueStorage, { useClass: ExpoSecureStoreAuthKeyValueStorage }],
      // Storage layer for synced host vault. Order matters only for documentation here —
      // redi resolves topology automatically.
      [IMobileSecretCipherService, { useClass: MobileSecretCipherService }],
      [IMobileSqliteDatabaseService, { useClass: MobileSqliteDatabaseService }],
      [IMobileHostRepository, { useClass: MobileHostRepository }],
    ];
    registerDependencies(this._injector, dependencies);
  }
}
