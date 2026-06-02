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

import { DependentOn, Inject, Injector, isMacintosh, Plugin, Quantity } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { Smartphone } from 'lucide-react';
import { IslandTab } from './views/settings/IslandTab';

export const ISLAND_SETTINGS_PLUGIN_NAME = 'ISLAND_SETTINGS_PLUGIN';

/**
 * Contributes the Island settings tab to the main renderer's settings dialog.
 *
 * Kept separate from {@link IslandUIPlugin} (the NSPanel runtime): the tab only
 * needs IslandTab + the shared sound-url constants, never the dynamic-island
 * services. The main Core registers this plugin; the island NSPanel renderer
 * registers IslandUIPlugin. The tab itself is self-contained — sound preview
 * runs on its own AudioContext, so no DI service is pulled into the main window.
 */
@DependentOn(RPCClientPlugin)
export class IslandSettingsPlugin extends Plugin {
  static override pluginName = ISLAND_SETTINGS_PLUGIN_NAME;

  constructor(
    @Inject(Injector) protected override _injector: Injector
  ) {
    super();
  }

  override onReady(): void {
    this._registerSettingsTab();
  }

  // Island only exists on macOS (the notch NSPanel), so skip registration
  // entirely elsewhere. Registered in onReady so SettingsUIPlugin's registry
  // binding (created in its onStarting) is already present; OPTIONAL injection
  // means windows without SettingsUIPlugin silently skip.
  private _registerSettingsTab(): void {
    if (!isMacintosh) {
      return;
    }
    const registry = this._injector.get(ISettingsTabRegistryService, Quantity.OPTIONAL);
    if (!registry) {
      return;
    }
    this.disposeWithMe(
      registry.register({
        id: 'island',
        labelKey: 'island-ui.island-tab.label',
        descriptionKey: 'island-ui.island-tab.description',
        icon: Smartphone,
        component: IslandTab,
        order: 100,
      })
    );
  }
}
