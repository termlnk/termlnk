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

export type ProjectScope = 'local' | 'remote';

export interface IProjectContext {
  /** Which session this context was derived from. */
  sessionId: string;
  scope: ProjectScope;
  /** Present when scope === 'remote'. */
  hostId?: string;
  /** Repository root when inside a Git work tree, otherwise equals `cwd`. */
  rootPath: string;
  cwd: string;
  isGitRepository: boolean;
}
