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
import type { IAgentUIPluginConfig } from './controllers/config.schema';
import { IProviderRegistryService } from '@termlnk/agent';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IContributionPointRegistry } from '@termlnk/extension';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { UIPlugin } from '@termlnk/ui';
import { AGENT_UI_PLUGIN_NAME } from './common/constants';
import { ProvidersPoint } from './contributions/providers.point';
import { AIAgentController } from './controllers/ai-agent.controller';
import { ChatPanelController } from './controllers/chat-panel.controller';
import { AGENT_UI_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { ProviderRegistryService } from './services/provider-registry.service';

@DependentOn(UIPlugin, RPCClientPlugin)
export class AgentUIPlugin extends Plugin {
  static override pluginName = AGENT_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IAgentUIPluginConfig = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(AGENT_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();
    this._registerContributionPoints();

    touchDependencies(this._injector, [
      [AIAgentController],
      [ChatPanelController],
    ]);
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [IProviderRegistryService, { useClass: ProviderRegistryService }],
      [AIAgentController],
      [ChatPanelController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  private _registerContributionPoints(): void {
    // `IContributionPointRegistry` is owned by `@termlnk/extension`. When the
    // extension subsystem is not loaded (e.g. headless/agent-only mode) the
    // service is absent; skip registration rather than hard-coupling to
    // the extension plugin via `@DependentOn`.
    if (!this._injector.has(IContributionPointRegistry)) {
      return;
    }
    const registry = this._injector.get(IContributionPointRegistry);
    const providersPoint = this._injector.createInstance(ProvidersPoint);
    this.disposeWithMe(registry.register(providersPoint));
  }
}
