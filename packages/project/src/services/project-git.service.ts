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
  IGitBranch,
  IGitCommit,
  IGitDiffOptions,
  IGitFileDiffStat,
  IGitLogOptions,
  IGitStatus,
} from '../models/git';
import type { IProjectContext } from '../models/project-context';
import { createIdentifier } from '@termlnk/core';

export interface IProjectGitService {
  status(context: IProjectContext): Promise<IGitStatus>;
  log(context: IProjectContext, options?: IGitLogOptions): Promise<IGitCommit[]>;
  diff(context: IProjectContext, options?: IGitDiffOptions): Promise<string>;
  /** Line counts per changed tracked file; untracked files are not included. */
  numstat(context: IProjectContext, options?: { commit?: string }): Promise<IGitFileDiffStat[]>;
  branches(context: IProjectContext): Promise<IGitBranch[]>;
  /** Switches the work tree; pass a `origin/x` name to track a remote branch. */
  checkout(context: IProjectContext, branch: string, options?: { remote?: boolean }): Promise<void>;
  stage(context: IProjectContext, paths: string[]): Promise<void>;
  unstage(context: IProjectContext, paths: string[]): Promise<void>;
  commit(context: IProjectContext, message: string): Promise<void>;
}

export const IProjectGitService = createIdentifier<IProjectGitService>(
  'project.project-git-service'
);
