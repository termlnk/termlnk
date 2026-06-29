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
import type { IAgentMobileConfig } from './controllers/config.schema';
import { IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { AGENT_MOBILE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { IMobileChatService, MobileChatService } from './services/chat.service';
import { IMobileProviderService, MobileProviderService } from './services/provider.service';
import { IMobileSessionService, MobileSessionService } from './services/session.service';

export const AGENT_MOBILE_PLUGIN_NAME = 'AGENT_MOBILE_PLUGIN';

export class AgentMobilePlugin extends Plugin {
  static override pluginName = AGENT_MOBILE_PLUGIN_NAME;

  protected readonly _injector: Injector;
  private readonly _config: IAgentMobileConfig;
  private readonly _configService: IConfigService;

  constructor(
    config: IAgentMobileConfig = defaultPluginConfig,
    @InjectSelf() injector: Injector,
    @IConfigService configService: IConfigService
  ) {
    super();
    this._injector = injector;
    this._configService = configService;
    this._config = config;
    this._configService.setConfig(AGENT_MOBILE_PLUGIN_CONFIG_KEY, merge({}, defaultPluginConfig, config));
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IMobileProviderService, { useClass: MobileProviderService }],
      [IMobileChatService, { useClass: MobileChatService }],
      [IMobileSessionService, { useClass: MobileSessionService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
