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

import type { ISkill, ISkillRepository } from '@termlnk/agent';

export function getSkillRepositoryForPath(skillPath: string, repositories: ISkillRepository[]): ISkillRepository | undefined {
  const normalizedPath = normalizePath(skillPath);

  return repositories.find((repository) => {
    const normalizedRepositoryPath = normalizePath(repository.localPath);
    return normalizedPath === normalizedRepositoryPath || normalizedPath.startsWith(`${normalizedRepositoryPath}/`);
  });
}

export function getSkillCountsByRepository(skills: ISkill[], repositories: ISkillRepository[]): Record<string, number> {
  return skills.reduce<Record<string, number>>((result, skill) => {
    const repository = getSkillRepositoryForPath(skill.path, repositories);
    if (repository) {
      result[repository.id] = (result[repository.id] ?? 0) + 1;
    }

    return result;
  }, {});
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/g, '');
}
