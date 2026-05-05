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

import type { DependencyOverride } from '@termlnk/core';
import type { IPermissionRule, ToolPermissionMode } from '../models/agent-tool-permission';
import type { IMcpConfig } from '../models/mcp';
import type { ISkillRepository } from '../models/skill-repository';
import type { ITerminalSuggestConfig } from '../models/terminal-suggest';

export const AGENT_PLUGIN_CONFIG_KEY = 'agent.config';

/** Sub-key for the inline terminal suggestion feature within AGENT_PLUGIN_CONFIG_KEY. */
export const AGENT_TERMINAL_SUGGEST_CONFIG_SUB_KEY = 'terminalSuggest';

export const configSymbol = Symbol(AGENT_PLUGIN_CONFIG_KEY);

export interface IAgentPluginConfig {
  override?: DependencyOverride;
  mcp?: IMcpConfig;
  activeModel?: string;
  skillRepositories?: ISkillRepository[];
  /** Persistent (user-scope) permission rules. Session rules live in memory only. */
  permissionRules?: IPermissionRule[];
  /** Last selected permission mode. Falls back to 'default' if absent. */
  permissionMode?: ToolPermissionMode;
  /** Inline terminal AI suggestions (NL2Cmd + error auto-fix). */
  terminalSuggest?: ITerminalSuggestConfig;
}

export const defaultPluginConfig: IAgentPluginConfig = {};
