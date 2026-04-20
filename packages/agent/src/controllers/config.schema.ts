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
import type { IMcpConfig } from '../models/mcp';
import type { ISkillRepository } from '../models/skill-repository';

export const AGENT_PLUGIN_CONFIG_KEY = 'agent.config';

export const configSymbol = Symbol(AGENT_PLUGIN_CONFIG_KEY);

export interface IAgentPluginConfig {
  override?: DependencyOverride;
  mcp?: IMcpConfig;
  activeModel?: string;
  skillRepositories?: ISkillRepository[];
}

export const defaultPluginConfig: IAgentPluginConfig = {};
