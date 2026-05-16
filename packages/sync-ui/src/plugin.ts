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
import type { ISyncUIPluginConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { SyncPlugin } from '@termlnk/sync';
import { defaultPluginConfig, SYNC_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { SyncUIController } from './controllers/sync-ui.controller';

export const SYNC_UI_PLUGIN_NAME = 'SYNC_UI_PLUGIN';

@DependentOn(SyncPlugin)
export class SyncUIPlugin extends Plugin {
  static override pluginName = SYNC_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: ISyncUIPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(SYNC_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [SyncUIController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [SyncUIController],
    ]);
  }
}
