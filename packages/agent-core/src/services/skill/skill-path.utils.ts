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

import type { SkillSource } from '@termlnk/agent';
import { join } from 'node:path';

export interface ISkillRootDirs {
  bundledSkillsDir?: string;
  userSkillsDir?: string;
}

export function resolveSkillRoot(source: SkillSource, dirs: ISkillRootDirs): string | undefined {
  if (source === 'builtin') {
    return dirs.bundledSkillsDir;
  }
  return dirs.userSkillsDir;
}

// Stored `skill.path` is a directory name relative to the per-source root, so the
// absolute path must be reassembled on each device — Mac/Windows resolve different roots.
export function resolveSkillAbsolutePath(skill: { source: SkillSource; path: string }, dirs: ISkillRootDirs): string {
  const root = resolveSkillRoot(skill.source, dirs);
  if (!root) {
    throw new Error(`No root directory configured for skill source: ${skill.source}`);
  }
  return join(root, skill.path);
}
