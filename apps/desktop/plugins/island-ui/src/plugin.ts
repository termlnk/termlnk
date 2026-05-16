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
import { DependentOn, IConfigService, Inject, Injector, isMacintosh, merge, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { Smartphone } from 'lucide-react';
import { of } from 'rxjs';
import { defaultPluginConfig, ISLAND_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { IslandUIController } from './controllers/island-ui.controller';
import { IIslandSceneService, IslandSceneService } from './services/island-scene.service';
import { IIslandSoundService, IslandSoundService } from './services/island-sound.service';
import { IIslandUIStateService, IslandUIStateService } from './services/island-state.service';
import { IPermissionRequestService, PermissionRequestService } from './services/permission-request.service';
import { IslandTab } from './views/settings/IslandTab';

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

    this._registerSettingsTab();
  }

  // Island settings only make sense on macOS, where the dynamic-island NSPanel
  // can actually mount. SettingsUIPlugin may not be present on secondary
  // windows (e.g. the island renderer itself), so register through OPTIONAL
  // injection — absence is fine.
  private _registerSettingsTab(): void {
    const registry = this._injector.get(ISettingsTabRegistryService, Quantity.OPTIONAL);
    if (!registry) {
      return;
    }
    this.disposeWithMe(
      registry.register({
        id: 'island',
        labelKey: 'settings-ui.tab.island',
        descriptionKey: 'settings-ui.tab-description.island',
        icon: Smartphone,
        component: IslandTab,
        order: 100,
        visible$: of(isMacintosh),
      })
    );
  }
}
