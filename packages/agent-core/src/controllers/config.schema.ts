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
  /**
   * Dynamic Island settings (macOS). Full schema in @termlnk/island;
   * only the `enabled` flag is consumed by agent-core to suppress
   * duplicate desktop notifications when the island UI is active.
   */
  islandSettings?: IIslandSettingsStored;
}

/**
 * Subset of the Dynamic Island settings schema relevant to agent-core.
 * The full payload (including sound config) is written by island-ui and
 * stored transparently — agent-core only reads `enabled`.
 */
export interface IIslandSettingsStored {
  enabled?: boolean;
}

export const defaultPluginConfig: IAgentCorePluginConfig = {};
