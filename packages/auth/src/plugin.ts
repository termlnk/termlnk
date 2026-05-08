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

import type { IAuthPluginConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, Plugin } from '@termlnk/core';
import { AUTH_PLUGIN_NAME } from './common/constants';
import { AUTH_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';

export { AUTH_PLUGIN_NAME };

/**
 * Auth 契约层插件——只承载 config 注册，不绑定任何具体实现。
 * 主进程实现由 @termlnk/auth-core 提供（P1.2/3/4）；
 * 渲染端门面由 @termlnk/rpc-client 注册（与现有 IXxxClientService 同模式）。
 */
export class AuthPlugin extends Plugin {
  static override pluginName = AUTH_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthPluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const merged = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(AUTH_PLUGIN_CONFIG_KEY, merged);
  }
}
