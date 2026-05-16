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
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
import { IContributionPointRegistry } from '@termlnk/extension';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { UIPlugin } from '@termlnk/ui';
import { MessageSquare, Sparkles } from 'lucide-react';
import { AGENT_UI_PLUGIN_NAME } from './common/constants';
import { ProvidersPoint } from './contributions/providers.point';
import { AIAgentController } from './controllers/ai-agent.controller';
import { ChatPanelController } from './controllers/chat-panel.controller';
import { AGENT_UI_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { GenerativeUIRegistryService, IGenerativeUIRegistryService } from './services/generative-ui/generative-ui-registry.service';
import { ProviderRegistryService } from './services/provider-registry.service';
import { AgentTab } from './views/settings/AgentTab';
import { AiProviderTab } from './views/settings/AiProviderTab';

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

  override onReady(): void {
    this._injector.get(ChatPanelController).registerBuiltinGenerativeUIComponents();
    this._registerSettingsTabs();
  }

  // CHAT and AI_PROVIDER tabs are agent-ui's responsibility — settings-ui owns
  // only the registry. Register through OPTIONAL injection so headless / agent-
  // only deployments without SettingsUIPlugin still boot cleanly.
  private _registerSettingsTabs(): void {
    const registry = this._injector.get(ISettingsTabRegistryService, Quantity.OPTIONAL);
    if (!registry) {
      return;
    }
    this.disposeWithMe(
      registry.register({
        id: 'ai-provider',
        labelKey: 'settings-ui.tab.ai-provider',
        descriptionKey: 'settings-ui.tab-description.ai-provider',
        icon: Sparkles,
        component: AiProviderTab,
        order: 70,
      })
    );
    this.disposeWithMe(
      registry.register({
        id: 'chat',
        labelKey: 'settings-ui.tab.chat',
        descriptionKey: 'settings-ui.tab-description.chat',
        icon: MessageSquare,
        component: AgentTab,
        order: 80,
      })
    );
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [IProviderRegistryService, { useClass: ProviderRegistryService }],
      [IGenerativeUIRegistryService, { useClass: GenerativeUIRegistryService }],
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
