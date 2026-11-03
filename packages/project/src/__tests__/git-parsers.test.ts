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
import { checkoutCommand } from '../git/commands';
import { parseBranches, parseNumstat, parseStatus } from '../git/parsers';
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

describe('parseBranches', () => {
  it('tells a slashed local branch apart from a remote one', () => {
    const stdout = [
      'refs/heads/main\0*\0origin/main',
      'refs/heads/feature/acp\0\0',
      'refs/remotes/origin/main\0\0',
      'refs/remotes/origin/HEAD\0\0',
      '',
    ].join('\n');

    expect(parseBranches(stdout)).toEqual([
      { name: 'main', current: true, remote: false, upstream: 'origin/main' },
      { name: 'feature/acp', current: false, remote: false, upstream: undefined },
      { name: 'origin/main', current: false, remote: true, upstream: undefined },
    ]);
  });
});

describe('parseNumstat', () => {
  it('parses plain records and rename records', () => {
    const stdout = [
      '12\t3\tsrc/a.ts',
      '0\t0\t',
      'src/old.ts',
      'src/new.ts',
      '-\t-\tassets/logo.png',
      '',
    ].join('\0');

    expect(parseNumstat(stdout)).toEqual([
      { path: 'src/a.ts', origPath: undefined, additions: 12, deletions: 3, binary: false },
      { path: 'src/new.ts', origPath: 'src/old.ts', additions: 0, deletions: 0, binary: false },
      { path: 'assets/logo.png', origPath: undefined, additions: 0, deletions: 0, binary: true },
    ]);
  });
});

describe('checkoutCommand', () => {
  it('tracks remote branches instead of detaching HEAD', () => {
    expect(checkoutCommand('feature/acp')).toEqual(['switch', 'feature/acp']);
    expect(checkoutCommand('origin/main', { remote: true })).toEqual([
      'switch',
      '--track',
      'origin/main',
    ]);
  });
});
