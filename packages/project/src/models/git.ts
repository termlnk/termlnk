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

export type GitFileStatusCode =
  | 'untracked'
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'unmerged'
  | 'ignored'
  | 'unknown';

export interface IGitFileStatus {
  path: string;
  /** Path before rename/copy when applicable. */
  origPath?: string;
  /** Index (staged) status. */
  index: GitFileStatusCode;
  /** Working tree status. */
  worktree: GitFileStatusCode;
}

export interface IGitBranchInfo {
  name: string;
  upstream?: string;
  ahead: number;
  behind: number;
  detached: boolean;
}

export interface IGitStatus {
  branch: IGitBranchInfo;
  files: IGitFileStatus[];
}

export interface IGitCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

export interface IGitLogOptions {
  limit?: number;
  skip?: number;
}

export interface IGitDiffOptions {
  /** Path relative to repo root. Empty = full diff. */
  path?: string;
  /** staged | worktree | commit range */
  staged?: boolean;
  commit?: string;
}

export interface IGitBranch {
  name: string;
  current: boolean;
  remote: boolean;
}
