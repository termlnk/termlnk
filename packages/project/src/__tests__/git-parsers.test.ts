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

import { describe, expect, it } from 'vitest';
import { parseStatus } from '../git/parsers';
import { buildRemoteGitCommand, shellQuote } from '../git/shell-escape';

describe('parseStatus', () => {
  it('parses branch headers and ordinary entries', () => {
    const stdout = [
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +1 -0',
      '1 M. N... 100644 100644 100644 h1 h2 src/a.ts',
      '? untracked.txt',
      '',
    ].join('\0');

    const status = parseStatus(stdout);
    expect(status.branch.name).toBe('main');
    expect(status.branch.upstream).toBe('origin/main');
    expect(status.branch.ahead).toBe(1);
    expect(status.branch.behind).toBe(0);
    expect(status.files).toEqual([
      { path: 'src/a.ts', index: 'modified', worktree: 'unknown' },
      { path: 'untracked.txt', index: 'untracked', worktree: 'untracked' },
    ]);
  });
});

describe('shellQuote', () => {
  it('escapes single quotes', () => {
    expect(shellQuote('it\'s')).toBe('\'it\'\\\'\'s\'');
  });

  it('builds remote git command with cwd', () => {
    const cmd = buildRemoteGitCommand('/tmp/proj', ['status', '--porcelain=v2']);
    expect(cmd).toBe('cd \'/tmp/proj\' && \'git\' \'status\' \'--porcelain=v2\'');
  });
});
