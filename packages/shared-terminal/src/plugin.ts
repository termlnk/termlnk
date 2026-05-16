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

import type { ISharedTerminalPluginConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, Plugin } from '@termlnk/core';
import { SHARED_TERMINAL_PLUGIN_NAME } from './common/constants';
import { defaultPluginConfig, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from './controllers/config.schema';

export { SHARED_TERMINAL_PLUGIN_NAME };

// Contract-only: registers config but binds no services. Implementation lives in
// @termlnk/shared-terminal-core. Main-process bootstrap order:
// AuthPlugin -> AuthCorePlugin -> SharedTerminalPlugin -> SharedTerminalCorePlugin.
export class SharedTerminalPlugin extends Plugin {
  static override pluginName = SHARED_TERMINAL_PLUGIN_NAME;

  constructor(
    private readonly _config: ISharedTerminalPluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const merged = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, merged);
  }
}
