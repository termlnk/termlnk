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
import type { IExtensionCorePluginConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { IExtensionRegistryService, IExtensionStateService, IExtensionStorageService } from '@termlnk/extension';
import { defaultPluginConfig, EXTENSION_CORE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { ExtensionInstallService, IExtensionInstallService } from './services/extension-install.service';
import { ExtensionRegistryService } from './services/extension-registry.service';
import { ExtensionStateService } from './services/extension-state.service';
import { ExtensionStorageService } from './services/extension-storage.service';

export const EXTENSION_CORE_PLUGIN_NAME = 'EXTENSION_CORE_PLUGIN';

@DependentOn(DatabasePlugin)
export class ExtensionCorePlugin extends Plugin {
  static override pluginName = EXTENSION_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IExtensionCorePluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(EXTENSION_CORE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IExtensionStorageService, { useClass: ExtensionStorageService }],
      [IExtensionInstallService, { useClass: ExtensionInstallService }],
      [IExtensionStateService, { useClass: ExtensionStateService }],
      [IExtensionRegistryService, { useClass: ExtensionRegistryService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
