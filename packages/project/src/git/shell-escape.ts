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

/** POSIX single-quote escape: ' → '\'' */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, '\'\\\'\'')}'`;
}

/**
 * Build `cd <cwd> && git <args...>` for SSH exec (string, not argv).
 *
 * An empty cwd yields a bare `git ...` that runs in the login home directory.
 * Quoting a placeholder like `~` instead would break the command outright:
 * single quotes suppress tilde expansion, so `cd '~'` fails.
 */
export function buildRemoteGitCommand(cwd: string, argv: string[]): string {
  const git = ['git', ...argv].map(shellQuote).join(' ');
  const dir = cwd.trim();
  return dir ? `cd ${shellQuote(dir)} && ${git}` : git;
}
