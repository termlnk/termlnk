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

/** Porcelain v2 + NUL separators: stable across git versions and locale-independent. */
export function statusCommand(): string[] {
  return ['status', '--porcelain=v2', '--branch', '-z'];
}

export function logCommand(limit = 50, skip = 0): string[] {
  return [
    'log',
    `--max-count=${limit}`,
    `--skip=${skip}`,
    '--format=%H%x00%h%x00%s%x00%an%x00%aI',
  ];
}

export function diffCommand(options: {
  path?: string;
  staged?: boolean;
  commit?: string;
} = {}): string[] {
  const args = ['diff', '--no-ext-diff', '--no-color'];
  if (options.staged) {
    args.push('--cached');
  }
  if (options.commit) {
    args.push(options.commit);
  }
  if (options.path) {
    args.push('--', options.path);
  }
  return args;
}

export function branchesCommand(): string[] {
  // Full refname, not `refname:short`: a local branch called `feature/acp` and a
  // remote `origin/main` are indistinguishable once shortened.
  return ['branch', '-a', '--format=%(refname)%00%(HEAD)%00%(upstream:short)'];
}

/**
 * Line counts for every changed tracked file. Compared against HEAD so staged
 * and unstaged edits land in one number per file, matching what the Changes
 * view shows. Untracked files are absent — `git diff` cannot see them, and
 * intent-to-add would mutate the user's index to find out.
 */
export function numstatCommand(options: { commit?: string } = {}): string[] {
  return ['diff', '--no-ext-diff', '--no-color', '--numstat', '-z', options.commit ?? 'HEAD'];
}

/**
 * `switch` rather than `checkout`: it refuses to silently detach HEAD. Remote
 * branches need --track to create the matching local branch instead.
 */
export function checkoutCommand(branch: string, options: { remote?: boolean } = {}): string[] {
  return options.remote ? ['switch', '--track', branch] : ['switch', branch];
}

export function stageCommand(paths: string[]): string[] {
  return ['add', '--', ...paths];
}

export function unstageCommand(paths: string[]): string[] {
  return ['restore', '--staged', '--', ...paths];
}

export function commitCommand(message: string): string[] {
  return ['commit', '-m', message];
}
