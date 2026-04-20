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

import type { IAgentPluginConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, Plugin } from '@termlnk/core';
import { DEFAULT_MCP_CONFIG } from './config/config';
import { AGENT_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';

export const AGENT_PLUGIN_NAME = 'AGENT_PLUGIN';

export class AgentPlugin extends Plugin {
  static override pluginName = AGENT_PLUGIN_NAME;

  constructor(
    private readonly _config: IAgentPluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const { ...rest } = merge(
      {},
      defaultPluginConfig,
      this._config
    );

    // Ensure MCP defaults are always present
    rest.mcp = merge({}, DEFAULT_MCP_CONFIG, rest.mcp);

    this._configService.setConfig(AGENT_PLUGIN_CONFIG_KEY, rest);
  }
}
