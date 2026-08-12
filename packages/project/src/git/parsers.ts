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

import type {
  GitFileStatusCode,
  IGitBranch,
  IGitBranchInfo,
  IGitCommit,
  IGitFileStatus,
  IGitStatus,
} from '../models/git';

export function parseStatus(stdout: string): IGitStatus {
  const parts = stdout.split('\0').filter((p) => p.length > 0);
  const branch: IGitBranchInfo = {
    name: 'HEAD',
    ahead: 0,
    behind: 0,
    detached: false,
  };
  const files: IGitFileStatus[] = [];

  let i = 0;
  while (i < parts.length) {
    const entry = parts[i];
    if (entry.startsWith('# branch.head ')) {
      const name = entry.slice('# branch.head '.length);
      branch.name = name;
      branch.detached = name === '(detached)';
      i += 1;
      continue;
    }
    if (entry.startsWith('# branch.upstream ')) {
      branch.upstream = entry.slice('# branch.upstream '.length);
      i += 1;
      continue;
    }
    if (entry.startsWith('# branch.ab ')) {
      const m = /# branch\.ab \+(\d+) -(\d+)/.exec(entry);
      if (m) {
        branch.ahead = Number(m[1]);
        branch.behind = Number(m[2]);
      }
      i += 1;
      continue;
    }
    if (entry.startsWith('# ')) {
      i += 1;
      continue;
    }

    // Ordinary changed entries: "1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>"
    // Rename: "2 <XY> ... <path>\0<origPath>" already split by \0
    // Untracked: "? <path>"
    if (entry.startsWith('? ')) {
      files.push({
        path: entry.slice(2),
        index: 'untracked',
        worktree: 'untracked',
      });
      i += 1;
      continue;
    }
    if (entry.startsWith('! ')) {
      files.push({
        path: entry.slice(2),
        index: 'ignored',
        worktree: 'ignored',
      });
      i += 1;
      continue;
    }
    if (entry.startsWith('u ')) {
      const path = entry.split(' ').at(-1) ?? entry;
      files.push({ path, index: 'unmerged', worktree: 'unmerged' });
      i += 1;
      continue;
    }
    if (entry.startsWith('1 ') || entry.startsWith('2 ')) {
      const tokens = entry.split(' ');
      const xy = tokens[1] ?? '..';
      const path = tokens.at(-1) ?? '';
      let origPath: string | undefined;
      if (entry.startsWith('2 ') && i + 1 < parts.length) {
        origPath = parts[i + 1];
        i += 1;
      }
      files.push({
        path,
        origPath,
        index: mapXy(xy[0] ?? '.'),
        worktree: mapXy(xy[1] ?? '.'),
      });
      i += 1;
      continue;
    }
    i += 1;
  }

  return { branch, files };
}

export function parseLog(stdout: string): IGitCommit[] {
  const commits: IGitCommit[] = [];
  const rows = stdout.split('\n').filter(Boolean);
  for (const row of rows) {
    const [hash, shortHash, subject, author, date] = row.split('\0');
    if (!hash) {
      continue;
    }
    commits.push({
      hash,
      shortHash: shortHash || hash.slice(0, 7),
      subject: subject || '',
      author: author || '',
      date: date || '',
    });
  }
  return commits;
}

export function parseBranches(stdout: string): IGitBranch[] {
  const branches: IGitBranch[] = [];
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [name, head] = line.split('\0');
    if (!name) {
      continue;
    }
    branches.push({
      name,
      current: head === '*',
      remote: name.includes('/'),
    });
  }
  return branches;
}

function mapXy(ch: string): GitFileStatusCode {
  switch (ch) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'U':
      return 'unmerged';
    case '?':
      return 'untracked';
    case '!':
      return 'ignored';
    case '.':
    case ' ':
      return 'unknown';
    default:
      return 'unknown';
  }
}
