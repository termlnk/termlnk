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

import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import process from 'node:process';

const FALLBACK_PATHS = [
  `${homedir()}/.local/bin`,
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
];

// Strip ANSI escape sequences that some shell configs emit.
const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

/**
 * Fix `process.env.PATH` for packaged Electron apps launched from
 * Finder / Dock, where the inherited PATH is minimal
 * (`/usr/bin:/bin:/usr/sbin:/sbin`).
 *
 * Spawns the user's login shell to capture the full PATH.
 * Falls back to appending common tool directories on failure.
 *
 * Must be called as early as possible in the main process — before
 * any child-process spawning (PTY, MCP stdio transport, etc.).
 */
export function fixProcessPath(): void {
  if (process.platform === 'win32') {
    return;
  }

  const shell = process.env.SHELL || '/bin/zsh';

  try {
    const stdout = execFileSync(shell, ['-ilc', 'printf "%s" "$PATH"'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const resolvedPath = stdout.replace(ANSI_RE, '').trim();
    if (resolvedPath) {
      process.env.PATH = resolvedPath;
      return;
    }
  } catch {
    // Shell spawn failed — fall through to fallback.
  }

  // Fallback: append common tool directories that are not already present.
  const currentPath = process.env.PATH || '';
  const dirs = currentPath.split(':').filter(Boolean);
  const missing = FALLBACK_PATHS.filter((p) => !dirs.includes(p));
  if (missing.length > 0) {
    process.env.PATH = [...dirs, ...missing].join(':');
  }
}
