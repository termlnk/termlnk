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
import type { ITerminalMobileConfig } from './controllers/config.schema';
import { IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { defaultPluginConfig, TERMINAL_MOBILE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { IMobileConnectionService, MobileConnectionService } from './services/mobile-connection.service';
import { IMobileSshClientService, MobileSshClientService } from './services/mobile-ssh-client.service';

export const TERMINAL_MOBILE_PLUGIN_NAME = 'TERMINAL_MOBILE_PLUGIN';

export class TerminalMobilePlugin extends Plugin {
  static override pluginName = TERMINAL_MOBILE_PLUGIN_NAME;

  protected readonly _injector: Injector;
  private readonly _config: ITerminalMobileConfig;
  private readonly _configService: IConfigService;

  constructor(
    config: ITerminalMobileConfig = defaultPluginConfig,
    @InjectSelf() injector: Injector,
    @IConfigService configService: IConfigService
  ) {
    super();
    this._injector = injector;
    this._configService = configService;
    this._config = config;
    this._configService.setConfig(TERMINAL_MOBILE_PLUGIN_CONFIG_KEY, merge({}, defaultPluginConfig, config));
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IMobileSshClientService, { useClass: MobileSshClientService }],
      [IMobileConnectionService, { useClass: MobileConnectionService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
