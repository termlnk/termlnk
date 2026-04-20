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
import type { IDiscoveredSkill, SkillSource } from '../models/skill';
import type { ISkillRepositoryMarketplaceItem } from '../models/skill-repository';
import { createIdentifier } from '@termlnk/core';

export interface ISkillDiscoveryService {
  readonly discovered$: Observable<IDiscoveredSkill[]>;

  discover(): Promise<IDiscoveredSkill[]>;
  discoverAt(path: string, source: SkillSource): Promise<IDiscoveredSkill[]>;
  discoverRepositorySkills(repositoryId?: string): Promise<ISkillRepositoryMarketplaceItem[]>;
}

export const ISkillDiscoveryService = createIdentifier<ISkillDiscoveryService>('agent.skill-discovery-service');
