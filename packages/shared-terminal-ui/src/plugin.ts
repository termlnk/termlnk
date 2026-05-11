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

import type { DependencyOverride, Injector } from '@termlnk/core';
import { DependentOn, InjectSelf, Plugin, Quantity } from '@termlnk/core';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { MonitorUpIcon } from 'lucide-react';
import { SharedTerminalPanel } from './views/SharedTerminalPanel';

export const SHARED_TERMINAL_UI_PLUGIN_NAME = 'SHARED_TERMINAL_UI_PLUGIN';

export interface ISharedTerminalUIPluginConfig {
  override?: DependencyOverride;
}

@DependentOn(SharedTerminalPlugin)
export class SharedTerminalUIPlugin extends Plugin {
  static override pluginName = SHARED_TERMINAL_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: ISharedTerminalUIPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
    void this._config;
  }

  override onReady(): void {
    const registry = this._injector.get(ISettingsTabRegistryService, Quantity.OPTIONAL);
    if (!registry) {
      return;
    }
    this.disposeWithMe(registry.register({
      id: 'shared-terminal',
      labelKey: 'shared-terminal-ui.tab.label',
      descriptionKey: 'shared-terminal-ui.tab.description',
      icon: MonitorUpIcon,
      component: SharedTerminalPanel,
      order: 115,
    }));
  }
}
