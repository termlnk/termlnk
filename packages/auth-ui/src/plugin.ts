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

import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { AuthPlugin } from '@termlnk/auth';
import { DependentOn, InjectSelf, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { UserRoundIcon } from 'lucide-react';
import { AuthUIController } from './controllers/auth-ui.controller';
import { AccountTab } from './views/settings/AccountTab';

export const AUTH_UI_PLUGIN_NAME = 'AUTH_UI_PLUGIN';

export interface IAuthUIPluginConfig {
  override?: DependencyOverride;
}

@DependentOn(AuthPlugin)
export class AuthUIPlugin extends Plugin {
  static override pluginName = AUTH_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthUIPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [AuthUIController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [AuthUIController],
    ]);

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
        icon: UserRoundIcon,
        component: AccountTab,
        order: 110,
      })
    );
  }
}
