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
  IGitFileDiffStat,
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

const LOCAL_REF_PREFIX = 'refs/heads/';
const REMOTE_REF_PREFIX = 'refs/remotes/';

export function parseBranches(stdout: string): IGitBranch[] {
  const branches: IGitBranch[] = [];
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [refname, head, upstream] = line.split('\0');
    if (!refname) {
      continue;
    }
    const remote = refname.startsWith(REMOTE_REF_PREFIX);
    const name = remote
      ? refname.slice(REMOTE_REF_PREFIX.length)
      : refname.replace(LOCAL_REF_PREFIX, '');
    // `origin/HEAD` is a symbolic pointer, not something to switch to.
    if (remote && name.endsWith('/HEAD')) {
      continue;
    }
    branches.push({
      name,
      current: head === '*',
      remote,
      upstream: upstream || undefined,
    });
  }
  return branches;
}

/**
 * `git diff --numstat -z` emits `adds\tdels\tpath\0` per file, except renames,
 * which drop the path from the record and follow with `\0old\0new\0`.
 */
export function parseNumstat(stdout: string): IGitFileDiffStat[] {
  const tokens = stdout.split('\0');
  const stats: IGitFileDiffStat[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const record = tokens[i];
    if (!record) {
      continue;
    }
    const [adds, dels, inlinePath] = record.split('\t');
    if (adds === undefined || dels === undefined) {
      continue;
    }

    let path = inlinePath ?? '';
    let origPath: string | undefined;
    if (!path) {
      // Rename: the two following tokens are the old and new paths.
      origPath = tokens[i + 1];
      path = tokens[i + 2] ?? '';
      i += 2;
    }
    if (!path) {
      continue;
    }

    const binary = adds === '-' || dels === '-';
    stats.push({
      path,
      origPath,
      additions: binary ? 0 : Number(adds) || 0,
      deletions: binary ? 0 : Number(dels) || 0,
      binary,
    });
  }

  return stats;
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
