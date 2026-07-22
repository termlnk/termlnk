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

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { skillEntity } from '../../entities/skill';

// Idempotent runtime migration: rewrite legacy absolute `skill.path` values into
// per-source relative paths (basename), then rebuild `registryId` to match. Necessary
// because the previous schema stored device-local absolute paths, which break under
// cross-device sync (Mac path won't exist on Windows).
export interface ISkillRelativePathResult {
  rewritten: number;
  scanned: number;
}

export async function runSkillRelativePathRuntimeMigration(
  db: BetterSQLite3Database
): Promise<ISkillRelativePathResult> {
  const result: ISkillRelativePathResult = { rewritten: 0, scanned: 0 };
  const skills = await db.select().from(skillEntity);

  for (const skill of skills) {
    result.scanned += 1;
    if (skill.source !== 'builtin' && skill.source !== 'user') {
      continue;
    }

    const basename = _toBasename(skill.path);
    if (basename === skill.path && _expectedRegistryId(skill.source, basename) === skill.registryId) {
      continue;
    }

    await db
      .update(skillEntity)
      .set({
        path: basename,
        registryId: _expectedRegistryId(skill.source, basename),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(skillEntity.id, skill.id));
    result.rewritten += 1;
  }

  return result;
}

function _toBasename(value: string): string {
  // Handle both POSIX and Windows separators since synced rows may carry either.
  const trimmed = value.replace(/[\\/]+$/g, '');
  const lastSep = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSep >= 0 ? trimmed.slice(lastSep + 1) : trimmed;
}

function _expectedRegistryId(source: string, relativePath: string): string {
  return `${source}:${relativePath}`;
}
