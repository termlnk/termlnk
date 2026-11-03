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

export { defaultPluginConfig, PROJECT_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IProjectPluginConfig } from './controllers/config.schema';
export {
  branchesCommand,
  checkoutCommand,
  commitCommand,
  diffCommand,
  logCommand,
  numstatCommand,
  stageCommand,
  statusCommand,
  unstageCommand,
} from './git/commands';
export { parseBranches, parseLog, parseNumstat, parseStatus } from './git/parsers';
export { buildRemoteGitCommand, shellQuote } from './git/shell-escape';
export type { IProjectFileEntry, ProjectFileType } from './models/fs';
export type {
  GitFileStatusCode,
  IGitBranch,
  IGitBranchInfo,
  IGitCommit,
  IGitDiffOptions,
  IGitFileDiffStat,
  IGitFileStatus,
  IGitLogOptions,
  IGitStatus,
} from './models/git';
export type { IProjectContext, ProjectScope } from './models/project-context';
export { PROJECT_PLUGIN_NAME, ProjectPlugin } from './plugin';
export { IProjectContextService } from './services/project-context.service';
export { IProjectCwdService } from './services/project-cwd.service';
export type { IProjectCwdChange } from './services/project-cwd.service';
export { IProjectFsService } from './services/project-fs.service';
export { IProjectGitService } from './services/project-git.service';
