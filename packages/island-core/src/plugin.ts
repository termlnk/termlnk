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
import type { IIslandCorePluginConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { IIslandStateService } from '@termlnk/island';
import { defaultPluginConfig, ISLAND_CORE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { IslandStateService } from './services/island-state.service';

export const ISLAND_CORE_PLUGIN_NAME = 'ISLAND_CORE_PLUGIN';

export class IslandCorePlugin extends Plugin {
  static override pluginName = ISLAND_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IIslandCorePluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    this._configService.setConfig(
      ISLAND_CORE_PLUGIN_CONFIG_KEY,
      merge({}, defaultPluginConfig, this._config)
    );
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IIslandStateService, { useClass: IslandStateService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
