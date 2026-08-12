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
import type { IBrowserUIPluginConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { UIPlugin } from '@termlnk/ui';
import { BROWSER_UI_PLUGIN_NAME } from './common/constants';
import { BrowserUIController } from './controllers/browser-ui.controller';
import { BROWSER_UI_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { BrowserService, IBrowserService } from './services/browser.service';

export { BROWSER_UI_PLUGIN_NAME };

@DependentOn(UIPlugin)
export class BrowserUIPlugin extends Plugin {
  static override pluginName = BROWSER_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IBrowserUIPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(BROWSER_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IBrowserService, { useClass: BrowserService }],
      [BrowserUIController],
    ];
    registerDependencies(
      this._injector,
      mergeOverrideWithDependencies(dependencies, this._config.override)
    );
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [IBrowserService],
      [BrowserUIController],
    ]);
  }
}
