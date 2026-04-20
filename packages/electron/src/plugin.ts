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
import type { IElectronConfig } from './controller/config.schema';
import { IConfigService, Inject, Injector, merge, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { defaultPluginConfig, ELECTRON_PLUGIN_CONFIG_KEY } from './controller/config.schema';
import { ElectronController } from './controller/electron.controller';

export const ELECTRON_PLUGIN_NAME = 'ELECTRON_PLUGIN';

export class ElectronPlugin extends Plugin {
  static override pluginName = ELECTRON_PLUGIN_NAME;

  constructor(
    private readonly _config: IElectronConfig = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(ELECTRON_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [ElectronController],
    ];
    registerDependencies(this._injector, dependencies);

    touchDependencies(this._injector, [
      [ElectronController],
    ]);
  }
}
