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

export type SkillSource = 'builtin' | 'user' | 'project' | 'marketplace' | 'extension';

export interface ISkill {
  id: string;
  name: string;
  description: string;
  path: string;
  source: SkillSource;
  version?: string;
  author?: string;
  tags: string[];
  allowedTools: string[];
  alwaysInject: boolean;
  enabled: boolean;
  sortOrder: number;
  checksum?: string;
}

export interface ISkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  license?: string;
  author?: string;
  homepage?: string;
  'allowed-tools'?: string[];
  'always-inject'?: boolean;
  'disable-model-invocation'?: boolean;
  tags?: string[];
}

export interface IDiscoveredSkill {
  discoveryKey: string;
  name: string;
  path: string;
  source: SkillSource;
  frontmatter: ISkillFrontmatter;
  checksum: string;
  content: string;
}

export interface ISkillState {
  skills: ISkill[];
  totalCount: number;
  enabledCount: number;
}

export interface ISkillChangeEvent {
  type: 'add' | 'update' | 'delete';
  id: string;
}
