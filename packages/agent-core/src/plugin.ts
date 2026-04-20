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

import type { IAgentPluginConfig } from '@termlnk/agent';
import type { Dependency } from '@termlnk/core';
import type { IAgentCorePluginConfig } from './controllers/config.schema';
import { AGENT_PLUGIN_CONFIG_KEY, DEFAULT_MCP_CONFIG, IAgentHookRegistryService, IAgentHookServerService, IAgentMonitorService, IAgentToolRegistryService, IAIAgentService, ICommandPermissionService, IHookLauncherService, IKeyboardInjectorService, ILLMProviderService, IMcpRegistryService, IMcpService, IMyMcpService, IPlatformContextService, ISkillDiscoveryService, ISkillInstallerService, ISkillPromptService, ISkillStateService, ISystemPromptService, SKILL_CONFIG_KEY } from '@termlnk/agent';
import { DependentOn, IConfigService, ILogService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { AgentHookController } from './controllers/agent-hook.controller';
import { CompactController } from './controllers/compact.controller';
import { AGENT_CORE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { McpController } from './controllers/mcp.controller';
import { MyMcpController } from './controllers/my-mcp.controller';
import { PlatformPromptController } from './controllers/platform-prompt.controller';
import { SkillAgentController } from './controllers/skill-agent.controller';
import { SkillController } from './controllers/skill.controller';
import { AgentMonitorService } from './services/agent/agent-monitor.service';
import { AIAgentService } from './services/agent/ai-agent.service';
import { AgentHookRegistryService } from './services/hook/agent-hook-registry.service';
import { AgentHookServerService } from './services/hook/agent-hook-server.service';
import { HookLauncherService } from './services/hook/hook-launcher.service';
import { KeyboardInjectorService } from './services/hook/keyboard-injector.service';
import { LLMProviderService } from './services/llm-provider/llm-provider.service';
import { AgentToolRegistryService } from './services/mcp/agent-tool-registry.service';
import { McpRegistryService } from './services/mcp/mcp-registry.service';
import { McpService } from './services/mcp/mcp.service';
import { MyMcpService } from './services/mcp/my-mcp.service';
import { CommandPermissionService } from './services/permission/command-permission.service';
import { PlatformContextService } from './services/platform/platform-context.service';
import { SystemPromptService } from './services/prompt/system-prompt.service';
import { SkillDiscoveryService } from './services/skill/skill-discovery.service';
import { SkillInstallerService } from './services/skill/skill-installer.service';
import { SkillPromptService } from './services/skill/skill-prompt.service';
import { SkillStateService } from './services/skill/skill-state.service';

export const AGENT_CORE_PLUGIN_NAME = 'AGENT_CORE_PLUGIN';

@DependentOn(DatabasePlugin)
export class AgentCorePlugin extends Plugin {
  static override pluginName = AGENT_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IAgentCorePluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(AGENT_CORE_PLUGIN_CONFIG_KEY, config);

    // Merge MCP config into the agent plugin config key
    const agentConfig = this._configService.getConfig<IAgentPluginConfig>(AGENT_PLUGIN_CONFIG_KEY) ?? {};
    this._configService.setConfig(AGENT_PLUGIN_CONFIG_KEY, {
      ...agentConfig,
      mcp: merge({}, DEFAULT_MCP_CONFIG, agentConfig.mcp, config.mcp),
    });

    // Set Skill config using the skill contract layer's key
    this._configService.setConfig(SKILL_CONFIG_KEY, {
      bundledSkillsDir: config.bundledSkillsDir,
    });
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      // Agent core services
      [IAIAgentService, { useClass: AIAgentService }],
      [ILLMProviderService, { useClass: LLMProviderService }],
      [ISystemPromptService, { useClass: SystemPromptService }],
      [IPlatformContextService, { useClass: PlatformContextService }],
      [ICommandPermissionService, { useClass: CommandPermissionService }],

      // Agent hook services
      [IAgentMonitorService, { useClass: AgentMonitorService }],
      [IAgentHookServerService, { useClass: AgentHookServerService }],
      [IAgentHookRegistryService, { useClass: AgentHookRegistryService }],
      [IKeyboardInjectorService, { useClass: KeyboardInjectorService }],
      [IHookLauncherService, {
        // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
        useFactory: (logService: ILogService) => new HookLauncherService(
          this._config.configPath,
          this._config.hookCliSrcDir,
          logService
        ),
        deps: [ILogService],
      }],

      // MCP services
      [IAgentToolRegistryService, { useClass: AgentToolRegistryService }],
      [IMyMcpService, { useClass: MyMcpService }],
      [IMcpService, { useClass: McpService }],
      [IMcpRegistryService, { useClass: McpRegistryService }],

      // Skill services
      [ISkillDiscoveryService, { useClass: SkillDiscoveryService }],
      [ISkillStateService, { useClass: SkillStateService }],
      [ISkillPromptService, { useClass: SkillPromptService }],
      [ISkillInstallerService, { useClass: SkillInstallerService }],

      // Controllers
      [AgentHookController],
      [MyMcpController],
      [McpController],
      [SkillController],
      [SkillAgentController],
      [PlatformPromptController],
      [CompactController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [AgentHookController],
      [MyMcpController],
      [McpController],
      [SkillController],
      [SkillAgentController],
      [PlatformPromptController],
      [CompactController],
    ]);
  }
}
