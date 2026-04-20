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

import { createIdentifier } from '@termlnk/core';

/**
 * Hook launcher service — responsible for installing the `@termlnk/agent-hook-cli`
 * files (`launcher.sh`, `launcher.cmd`, `helper.js`) into the user's home
 * directory at app startup so external AI agents (running in any terminal)
 * can invoke the helper to forward hook events to the running Termlnk HTTP
 * hook server.
 *
 * Called by `AgentHookController` before registering hook adapters, and the
 * resolved launcher path is written into each agent's native hook config
 * (e.g., `~/.claude/settings.json`).
 */
export interface IHookLauncherService {
  /**
   * Absolute path to the platform-specific launcher script that should be
   * written into agent hook configs. On POSIX systems this is
   * `<configPath>/bin/termlnk-hook`; on Windows it is
   * `<configPath>\bin\termlnk-hook.cmd`.
   */
  getLauncherPath(): string;

  /**
   * Copy the CLI source files into the user's home directory. Overwrites
   * any existing files to keep the installed launcher in sync with the
   * running app version.
   *
   * Returns `true` when the launcher is available after the call (either
   * successfully installed or already present and up-to-date), `false` when
   * the source directory is missing or the install failed.
   */
  install(): Promise<boolean>;

  /**
   * Whether the launcher is currently installed and usable. Used by callers
   * that need to decide whether to fall back to the legacy inline curl
   * format in adapters.
   */
  isAvailable(): boolean;
}

export const IHookLauncherService = createIdentifier<IHookLauncherService>(
  'agent.hook-launcher-service'
);
