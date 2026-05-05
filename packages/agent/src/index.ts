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

export { AGENT_COMPACT_CONFIG_SUB_KEY, AGENT_CORE_CONFIG_KEY, AI_PLUGIN_NAME, AI_STORAGE_PROVIDERS_KEY, DEFAULT_THINKING_LEVEL } from './common/constants';
export { PROMPT_DYNAMIC_BOUNDARY, PROMPT_PRIORITY, PROMPT_SECTION } from './common/prompt-constants';
export { PLATFORM_SSH_SECTION } from './common/prompt-sections';
export { compareProviders, DEFAULT_PROVIDER_BASE_URL, DEFAULT_PROVIDER_SORT, formatProviderDisplayName, getDefaultProviderBaseUrl, getDefaultProviderSort, PROVIDER_DISPLAY_NAME, UNSUPPORTED_MODEL_SYNC_PROVIDERS } from './common/provider-metadata';
export { SKILL_BUNDLED_DIR, SKILL_CONFIG_KEY, SKILL_PLUGIN_NAME, SKILL_PROJECT_DIR, SKILL_REPOSITORY_CLONE_DIR, SKILL_USER_DIR } from './common/skill-constants';
export { DEFAULT_MCP_CONFIG } from './config/config';
export { AGENT_PLUGIN_CONFIG_KEY, AGENT_TERMINAL_SUGGEST_CONFIG_SUB_KEY } from './controllers/config.schema';
export type { IAgentPluginConfig } from './controllers/config.schema';
export type { AgentStatus, ChatRole, IAgentConfig, IChatMessage, IChatUsage, IErrorPart, IImageAttachment, IImagePart, IMessagePart, ISendMessageOptions, ITextPart, IThinkingPart, IToolOutput, IToolPart, MessageDeliveryMode, ThinkingLevel, ToolPartState } from './models/agent';
export { AGENT_DISPLAY_NAMES, AGENT_HOOK_CONFIG_KEY, DEFAULT_AGENT_HOOK_CONFIG, TERMLNK_HOOK_MARKER } from './models/agent-hook';
export type { AgentHookEventType, AgentHookFormat, AgentSessionSource, AgentSessionStatus, AgentTodoStatus, ExternalAgentType, IAgentHookConfig, IAgentHookDefinition, IAgentHookEvent, IAgentHookEventMapping, IAgentHookEventMeta, IAgentTodo, IAskUserQuestion, IAskUserQuestionRequestPayload, IAskUserQuestionSet, IExternalAgentSession, IPendingInteractionPayload, IPermissionDecision, IPermissionRequestPayload, IPermissionResponsePayload, PendingInteractionKind } from './models/agent-hook';
export type { IAgentToolPermissionRequest, IAgentToolPermissionResponse, IPermissionDecisionReason, IPermissionRule, IPermissionRuleInput, ISuggestedRule, IToolInputHighlight, ToolPermissionDecision, ToolPermissionMode, ToolPermissionScope, ToolRiskLevel } from './models/agent-tool-permission';
export { KNOWN_API_TYPES } from './models/api-metadata';
export type { IApiTypeMetadata } from './models/api-metadata';
export { COMPACT_CONFIG_MAX_KEEP_RECENT, COMPACT_CONFIG_MAX_THRESHOLD_PERCENT, COMPACT_CONFIG_MIN_KEEP_RECENT, COMPACT_CONFIG_MIN_THRESHOLD_PERCENT, DEFAULT_COMPACT_CONFIG, normalizeCompactConfig } from './models/compact';
export type { CompactTrigger, ICompactConfig, ICompactMetadata, ICompactOptions } from './models/compact';
export type { IMcpConfig, IMcpSettingsConfig } from './models/mcp';
export type { IMcpInstalledServer, IMcpRemoteTool, IMcpServer, IMcpServerChangeEvent } from './models/mcp';
export type { IMcpServerCapabilities, McpConnectionStatus, McpRemoteProtocol, McpServerConfig, McpTransportType } from './models/mcp';
export type { IMcpRegistryInstallInput, IMcpRegistryInstallOption, IMcpRegistryItem, McpRegistryCategory, McpRegistryInputKind, McpRegistryInstallSource, McpRegistryStatus } from './models/mcp-registry';
export type { ICustomModelDefinition, ILLMProvider, IModelOption, IModelOverrides, IModelUserConfig, IProviderGroup, IProviderUserConfig } from './models/provider';
export type { IDiscoveredSkill, ISkill, ISkillChangeEvent, ISkillFrontmatter, ISkillState, SkillSource } from './models/skill';
export type { IAddSkillRepositoryInput, ISkillRepository, ISkillRepositoryMarketplaceItem, IUpdateSkillRepositoryInput, SkillRepositoryProvider } from './models/skill-repository';
export type { IAIAgentState } from './models/state';
export { DEFAULT_NL_PREFIX_CHAR, DEFAULT_TERMINAL_SUGGEST_CONFIG } from './models/terminal-suggest';
export type { ITerminalSuggestConfig, ITerminalSuggestion, ITerminalSuggestionPhaseEvent, TerminalSuggestionKind, TerminalSuggestionPhase } from './models/terminal-suggest';
export type { AgentToolCategory, IAgentTool, IAgentToolContent, IAgentToolInputSchema, IAgentToolResult } from './models/tool';
export { AGENT_PLUGIN_NAME, AgentPlugin } from './plugin';
export type { IAgentHookAdapter } from './services/agent-hook-adapter.service';
export { IAgentHookRegistryService } from './services/agent-hook-registry.service';
export { IAgentHookServerService } from './services/agent-hook-server.service';
export { IAgentMonitorService } from './services/agent-monitor.service';
export type { IGuardInput, IGuardMetadata, IGuardResult } from './services/agent-tool-permission.service';
export { IAgentToolPermissionService } from './services/agent-tool-permission.service';
export { IAgentToolRegistryService } from './services/agent-tool-registry.service';
export { IAIAgentService } from './services/ai-agent.service';
export { IHookLauncherService } from './services/hook-launcher.service';
export { ILLMProviderService } from './services/llm-provider.service';
export { IMcpRegistryService } from './services/mcp-registry.service';
export { IMyMcpService } from './services/mcp-server.service';
export type { IMyMcpServer } from './services/mcp-server.service';
export { IMcpService } from './services/mcp.service';
export type { IShadowedRule } from './services/permission-rule.service';
export { IPermissionRuleService } from './services/permission-rule.service';
export { IPlatformContextService } from './services/platform-context.service';
export type { IActiveSessionContext, IPlatformContext, PlatformType, ShellType } from './services/platform-context.service';
export type { IProviderChatRequest, IProviderDefinition, IProviderModelInfo, IRegisteredProvider, ProviderSdkType } from './services/provider-registry.service';
export { IProviderRegistryService } from './services/provider-registry.service';
export type { IRiskAssessment } from './services/risk-assessment.service';
export { IRiskAssessmentService } from './services/risk-assessment.service';
export { ISkillDiscoveryService } from './services/skill-discovery.service';
export { ISkillInstallerService } from './services/skill-installer.service';
export { ISkillPromptService } from './services/skill-prompt.service';
export { ISkillStateService } from './services/skill-state.service';
export { ISkillService } from './services/skill.service';
export { ISystemPromptService } from './services/system-prompt.service';
export type { IPromptSectionRegistration } from './services/system-prompt.service';
export { ITerminalSuggestService } from './services/terminal-suggest.service';
export { defaultFieldFor, matchPattern, matchRule } from './utils/permission-matcher';
