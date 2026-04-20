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

export type SkillRepositoryProvider = 'github';

export interface IAddSkillRepositoryInput {
  repository: string;
  branch?: string;
  subdirectory?: string;
}

export interface IUpdateSkillRepositoryInput extends IAddSkillRepositoryInput {
  id: string;
}

export interface ISkillRepository {
  id: string;
  provider: SkillRepositoryProvider;
  owner: string;
  repo: string;
  branch?: string;
  subdirectory?: string;
  url: string;
  cloneUrl: string;
  displayName: string;
  localPath: string;
  addedAt: string;
}

export interface ISkillRepositoryMarketplaceItem {
  id: string;
  name: string;
  description: string;
  path: string;
  version?: string;
  author?: string;
  homepage?: string;
  license?: string;
  tags: string[];
  allowedTools: string[];
  alwaysInject: boolean;
  repositoryId: string;
  repositoryName: string;
  repositoryUrl: string;
  repositoryBranch?: string;
  repositorySubdirectory?: string;
}
