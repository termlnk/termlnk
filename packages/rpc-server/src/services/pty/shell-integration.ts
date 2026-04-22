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

import { mkdirSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'node:process';
import {
  getBashIntegrationScript,
  getFishIntegrationScript,
  getZshEnvBootstrap,
  getZshIntegrationScript,
} from '../shell-integration/scripts';

/**
 * Delay (in ms) before injecting the bash integration source command.
 * Bash does not support a clean startup-time injection mechanism like ZDOTDIR (zsh)
 * or --init-command (fish), so we wait briefly for the shell to finish initializing
 * before writing the source command to the PTY.
 */
export const BASH_INJECTION_DELAY_MS = 100;

export interface IShellIntegrationSetup {
  /** Extra arguments to append to the shell spawn args. */
  extraArgs: string[];
  /** Environment variables to set before spawn. Maps key to value. */
  envOverrides: Record<string, string>;
  /** Environment variable keys to restore after spawn (key -> original value or undefined). */
  envToRestore: Record<string, string | undefined>;
  /** If non-null, a script path to inject via PTY write after a delay (bash only). */
  postSpawnInjection: string | null;
}

/**
 * Prepare shell integration for the given shell.
 * Writes integration scripts to disk and returns setup instructions
 * for the caller to apply before/after PTY spawn.
 *
 * Returns null if the shell is unsupported or file creation fails.
 */
export function prepareShellIntegration(shellName: string, configPath: string): IShellIntegrationSetup | null {
  const siDir = ensureShellIntegrationFiles(shellName, configPath);
  if (!siDir) {
    return null;
  }

  const setup: IShellIntegrationSetup = {
    extraArgs: [],
    envOverrides: {},
    envToRestore: {},
    postSpawnInjection: null,
  };

  if (shellName === 'zsh') {
    setup.envToRestore = {
      ZDOTDIR: process.env.ZDOTDIR,
      TERMLNK_ORIGINAL_ZDOTDIR: process.env.TERMLNK_ORIGINAL_ZDOTDIR,
    };
    setup.envOverrides = {
      TERMLNK_ORIGINAL_ZDOTDIR: process.env.ZDOTDIR || os.homedir(),
      ZDOTDIR: path.join(siDir, 'zsh'),
    };
  } else if (shellName === 'fish') {
    setup.extraArgs.push('--init-command', `source "${path.join(siDir, 'fish.fish')}"`);
  } else if (shellName === 'bash') {
    setup.postSpawnInjection = path.join(siDir, 'bash.sh');
  }

  return setup;
}

/**
 * Apply environment overrides from the shell integration setup.
 * Must be called before PTY spawn.
 */
export function applyEnvOverrides(setup: IShellIntegrationSetup): void {
  for (const [key, val] of Object.entries(setup.envOverrides)) {
    process.env[key] = val;
  }
}

/**
 * Restore environment variables that were overridden before spawn.
 * Must be called after PTY spawn (the child process has already captured them at fork time).
 */
export function restoreEnvOverrides(setup: IShellIntegrationSetup): void {
  for (const [key, val] of Object.entries(setup.envToRestore)) {
    if (val !== undefined) {
      process.env[key] = val;
    } else {
      delete process.env[key];
    }
  }
}

// ---------------------------------------------------------------------------
// File generation
// ---------------------------------------------------------------------------

/**
 * Write shell integration scripts to ~/.config/termlnk/shell-integration/ and return the base directory.
 * Returns null if the shell is unsupported or file creation fails.
 */
function ensureShellIntegrationFiles(shellName: string, configPath: string): string | null {
  if (!['bash', 'zsh', 'fish'].includes(shellName)) {
    return null;
  }

  const shellIntegrationDir = path.join(configPath, 'shell-integration');

  try {
    mkdirSync(shellIntegrationDir, { recursive: true });

    if (shellName === 'zsh') {
      const zshDir = path.join(shellIntegrationDir, 'zsh');
      mkdirSync(zshDir, { recursive: true });
      writeFileSync(path.join(zshDir, '.zshenv'), getZshEnvBootstrap(), { mode: 0o644 });
      writeFileSync(path.join(zshDir, 'integration.zsh'), getZshIntegrationScript(), { mode: 0o644 });
    } else if (shellName === 'bash') {
      writeFileSync(path.join(shellIntegrationDir, 'bash.sh'), getBashIntegrationScript(), { mode: 0o644 });
    } else if (shellName === 'fish') {
      writeFileSync(path.join(shellIntegrationDir, 'fish.fish'), getFishIntegrationScript(), { mode: 0o644 });
    }

    return shellIntegrationDir;
  } catch {
    return null;
  }
}
