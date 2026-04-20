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

import type { Observable } from 'rxjs';
import type { ISkill, ISkillChangeEvent } from '../models/skill';
import type { IAddSkillRepositoryInput, ISkillRepository, ISkillRepositoryMarketplaceItem, IUpdateSkillRepositoryInput } from '../models/skill-repository';
import { createIdentifier } from '@termlnk/core';

export interface ISkillService {
  getAll(): Promise<ISkill[]>;
  getEnabled(): Promise<ISkill[]>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  setSortOrder(id: string, sortOrder: number): Promise<void>;
  getContent(id: string): Promise<string>;
  refresh(): Promise<void>;
  getRepositories(): Promise<ISkillRepository[]>;
  addRepository(input: IAddSkillRepositoryInput): Promise<ISkillRepository>;
  updateRepository(input: IUpdateSkillRepositoryInput): Promise<ISkillRepository>;
  removeRepository(id: string): Promise<void>;
  uninstall(id: string): Promise<void>;
  getRepositoryMarketplaceItems(repositoryId?: string): Promise<ISkillRepositoryMarketplaceItem[]>;
  installRepositorySkill(id: string): Promise<void>;
  onChanged$(): Observable<ISkillChangeEvent>;
}
export const ISkillService = createIdentifier<ISkillService>('agent.skill-service');
