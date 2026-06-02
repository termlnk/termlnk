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
import type { IIslandUIPluginConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { defaultPluginConfig, ISLAND_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { IslandUIController } from './controllers/island-ui.controller';
import { IIslandSceneService, IslandSceneService } from './services/island-scene.service';
import { IIslandSoundService, IslandSoundService } from './services/island-sound.service';
import { IIslandUIStateService, IslandUIStateService } from './services/island-state.service';
import { IPermissionRequestService, PermissionRequestService } from './services/permission-request.service';

export const ISLAND_UI_PLUGIN_NAME = 'ISLAND_UI_PLUGIN';

@DependentOn(RPCClientPlugin)
export class IslandUIPlugin extends Plugin {
  static override pluginName = ISLAND_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IIslandUIPluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    this._configService.setConfig(
      ISLAND_UI_PLUGIN_CONFIG_KEY,
      merge({}, defaultPluginConfig, this._config)
    );
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IIslandUIStateService, { useClass: IslandUIStateService }],
      [IIslandSceneService, { useClass: IslandSceneService }],
      [IPermissionRequestService, { useClass: PermissionRequestService }],
      [IIslandSoundService, { useClass: IslandSoundService }],
      [IslandUIController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [IIslandUIStateService],
      [IIslandSceneService],
      [IPermissionRequestService],
      [IIslandSoundService],
      [IslandUIController],
    ]);
  }
}
