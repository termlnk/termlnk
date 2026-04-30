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

import type { IAddSkillRepositoryInput, ISkillRepository, IUpdateSkillRepositoryInput } from '../models/skill-repository';
import { createIdentifier } from '@termlnk/core';

export interface ISkillInstallerService {
  installFromPath(sourcePath: string): Promise<string>;
  getRepositories(): Promise<ISkillRepository[]>;
  addRepository(input: IAddSkillRepositoryInput): Promise<ISkillRepository>;
  updateRepository(input: IUpdateSkillRepositoryInput): Promise<ISkillRepository>;
  removeRepository(id: string): Promise<void>;
  uninstall(id: string): Promise<void>;
}

export const ISkillInstallerService = createIdentifier<ISkillInstallerService>('agent.skill-installer-service');
