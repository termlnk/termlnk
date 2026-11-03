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

import type { ICompactConfig, IMcpConfig } from '@termlnk/agent';
import type { DependencyOverride } from '@termlnk/core';

// Canonical definition lives in @termlnk/agent; re-exported here so
// internal files can import from the config-schema barrel.
export { AGENT_CORE_PLUGIN_CONFIG_KEY } from '@termlnk/agent';

export interface IAgentCorePluginConfig {
  override?: DependencyOverride;
  /** Read-only directory containing built-in skills shipped with the app. */
  bundledSkillsDir?: string;
  /** Read-write directory for user-installed skills. */
  userSkillsDir?: string;
  /**
   * Shared Termlnk config root (e.g. `~/.config/termlnk` on POSIX). Only
   * used by {@link LegacyAgentHookCleanupController} to find leftover hook
   * launcher files.
   */
  configPath?: string;
  mcp?: IMcpConfig;
  compact?: ICompactConfig;
  /** Persisted: true once the one-time legacy agent-hook cleanup has finished. */
  legacyAgentHookCleanupDone?: boolean;
}

export const defaultPluginConfig: IAgentCorePluginConfig = {};
