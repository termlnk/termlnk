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
import type { IAuthUIPluginConfig } from './controllers/config.schema';
import { AuthPlugin } from '@termlnk/auth';
import { DependentOn, IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { UIPlugin } from '@termlnk/ui';
import { LaptopMinimalIcon } from 'lucide-react';
import { AccountDialogController } from './controllers/account-dialog.controller';
import { AuthUIController } from './controllers/auth-ui.controller';
import { AUTH_UI_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { AccountDialogService } from './services/account-dialog/account-dialog.service';
import { AccountTab } from './views/settings/AccountTab';

export const AUTH_UI_PLUGIN_NAME = 'AUTH_UI_PLUGIN';

@DependentOn(AuthPlugin, UIPlugin)
export class AuthUIPlugin extends Plugin {
  static override pluginName = AUTH_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthUIPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(AUTH_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [AuthUIController],
      [AccountDialogService],
      [AccountDialogController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));

    touchDependencies(this._injector, [
      [AccountDialogController],
      [AuthUIController],
    ]);
  }

  override onReady(): void {
    this._registerSettingsTab();
  }

  private _registerSettingsTab(): void {
    // OPTIONAL: settings-ui may not be loaded (e.g., island secondary window).
    const registry = this._injector.get(ISettingsTabRegistryService, Quantity.OPTIONAL);
    if (!registry) {
      return;
    }

    this.disposeWithMe(
      registry.register({
        id: 'account',
        labelKey: 'settings-ui.tab.account',
        descriptionKey: 'settings-ui.tab-description.account',
        icon: LaptopMinimalIcon,
        component: AccountTab,
        order: 110,
      })
    );
  }
}
