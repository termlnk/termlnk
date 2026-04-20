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

export const AGENT_CORE_PLUGIN_CONFIG_KEY = 'agent-core.config';

export interface IAgentCorePluginConfig {
  override?: DependencyOverride;
  bundledSkillsDir?: string;
  /**
   * Shared Termlnk config root (e.g. `~/.config/termlnk` on POSIX).
   * Resolved by desktop main and passed in via plugin config; reused by:
   *   - {@link IHookLauncherService} → writes `<configPath>/bin/termlnk-hook`
   *     and `<configPath>/bin/hook-helper.js`
   *   - {@link IAgentHookServerService} → publishes `<configPath>/runtime.json`
   * so external-terminal agents can discover the running Termlnk server.
   */
  configPath?: string;
  /**
   * Absolute path to the `@termlnk/agent-hook-cli` source directory (the
   * one containing `helper.js`, `launcher.sh`, `launcher.cmd`). The
   * {@link IHookLauncherService} copies these files into `<configPath>/bin/`
   * on app startup so external terminal agents can invoke them.
   *
   * Desktop main resolves this from `packages/agent-hook-cli/src` in dev
   * and `<resources>/agent-hook-cli` in production builds.
   */
  hookCliSrcDir?: string;
  mcp?: IMcpConfig;
  compact?: ICompactConfig;
}

export const defaultPluginConfig: IAgentCorePluginConfig = {};
