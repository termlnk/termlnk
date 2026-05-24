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

import type { ISkill, ISkillPromptService } from '@termlnk/agent';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ISkillStateService, SKILL_CONFIG_KEY } from '@termlnk/agent';
import { Disposable, IConfigService } from '@termlnk/core';
import { resolveSkillAbsolutePath } from './skill-path.utils';

export class SkillPromptService extends Disposable implements ISkillPromptService {
  private _cachedSkills: ISkill[] = [];

  constructor(
    @ISkillStateService private readonly _stateService: ISkillStateService,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    this.disposeWithMe(
      this._stateService.skills$.subscribe((skills) => {
        this._cachedSkills = skills;
      })
    );
  }

  getSkillIndex(selectedSkillIds?: string[] | null): string {
    const enabledSkills = this._getScopedSkills(selectedSkillIds);
    if (enabledSkills.length === 0) {
      return '<available_skills />';
    }

    const items = enabledSkills.map((s) =>
      `  <skill name="${s.name}" description="${escapeXml(s.description)}" source="${s.source}" />`
    );

    return `<available_skills>\n${items.join('\n')}\n</available_skills>`;
  }

  async getSkillContent(name: string): Promise<string> {
    const skill = this._cachedSkills.find((s) => s.name === name && s.enabled);
    if (!skill) {
      throw new Error(`Skill not found or disabled: ${name}`);
    }

    const dirs = this._configService.getConfig<{ bundledSkillsDir?: string; userSkillsDir?: string }>(SKILL_CONFIG_KEY) ?? {};
    const skillFile = join(resolveSkillAbsolutePath(skill, dirs), 'SKILL.md');
    return readFileSync(skillFile, 'utf-8');
  }

  getAutoInjectSkills(selectedSkillIds?: string[] | null): ISkill[] {
    return this._getScopedSkills(selectedSkillIds).filter((s) => s.alwaysInject);
  }

  private _getScopedSkills(selectedSkillIds?: string[] | null): ISkill[] {
    const enabledSkills = this._cachedSkills.filter((s) => s.enabled);
    if (!selectedSkillIds) {
      return enabledSkills;
    }

    const selectedIds = new Set(selectedSkillIds);
    return enabledSkills.filter((skill) => selectedIds.has(skill.id));
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
