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
import type { IACPUIPluginConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { TerminalUIPlugin } from '@termlnk/terminal-ui';
import { UIPlugin } from '@termlnk/ui';
import { Bot } from 'lucide-react';
import { ACP_UI_PLUGIN_NAME } from './common/constants';
import { ACPUIController } from './controllers/acp-ui.controller';
import { ACP_UI_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { ACPSessionLauncher, IACPSessionLauncher } from './services/acp-session-launcher.service';
import { ACPTab } from './views/settings/ACPTab';

export { ACP_UI_PLUGIN_NAME };

@DependentOn(UIPlugin, TerminalUIPlugin, RPCClientPlugin)
export class ACPUIPlugin extends Plugin {
  static override pluginName = ACP_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IACPUIPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(ACP_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IACPSessionLauncher, { useClass: ACPSessionLauncher }],
      [ACPUIController],
    ];
    registerDependencies(
      this._injector,
      mergeOverrideWithDependencies(dependencies, this._config.override)
    );
  }

  override onReady(): void {
    // Controllers must start after TerminalUIPlugin has registered its default
    // add-session handler so our override wins the single-slot registry.
    touchDependencies(this._injector, [
      [ACPUIController],
    ]);
    this._registerSettingsTab();
  }

  /**
   * The Agents tab belongs to acp-ui; settings-ui only owns the registry.
   * OPTIONAL injection so deployments without SettingsUIPlugin still boot.
   */
  private _registerSettingsTab(): void {
    const registry = this._injector.get(ISettingsTabRegistryService, Quantity.OPTIONAL);
    if (!registry) {
      return;
    }
    this.disposeWithMe(
      registry.register({
        id: 'acp-agents',
        labelKey: 'acp-ui.settings.tab',
        descriptionKey: 'acp-ui.settings.tab-description',
        icon: Bot,
        component: ACPTab,
        order: 75,
      })
    );
  }
}
