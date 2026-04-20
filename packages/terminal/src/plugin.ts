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
import type { ITerminalConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, Plugin, registerDependencies } from '@termlnk/core';
import { defaultPluginConfig, TERMINAL_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { IShellIntegrationService, ShellIntegrationService } from './services/shell-integration.service';

export const TERMINAL_PLUGIN_NAME = 'TERMINAL_PLUGIN';

export class TerminalPlugin extends Plugin {
  static override pluginName = TERMINAL_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<ITerminalConfig> = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService protected readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(TERMINAL_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IShellIntegrationService, { useClass: ShellIntegrationService }],
    ];
    registerDependencies(this._injector, dependencies);
  }
}
