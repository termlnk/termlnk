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

import type { ISyncPluginConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, Plugin } from '@termlnk/core';
import { SYNC_PLUGIN_NAME } from './common/constants';
import { defaultPluginConfig, SYNC_PLUGIN_CONFIG_KEY } from './controllers/config.schema';

export { SYNC_PLUGIN_NAME };

/**
 * Sync 契约层插件——只承载 config 注册，不绑定任何具体实现。
 * 主进程实现由 @termlnk/sync-core 提供（P2.2/3/4/5/6）。
 */
export class SyncPlugin extends Plugin {
  static override pluginName = SYNC_PLUGIN_NAME;

  constructor(
    private readonly _config: ISyncPluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const merged = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(SYNC_PLUGIN_CONFIG_KEY, merged);
  }
}
