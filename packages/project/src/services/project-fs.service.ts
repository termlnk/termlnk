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

import type { IProjectFileEntry } from '../models/fs';
import type { IProjectContext } from '../models/project-context';
import { createIdentifier } from '@termlnk/core';

/**
 * Unified FS surface for local + remote project trees.
 * Implementations live in rpc-server (main) and rpc-client (renderer facade).
 */
export interface IProjectFsService {
  list(context: IProjectContext, path: string): Promise<IProjectFileEntry[]>;
  readFile(context: IProjectContext, path: string): Promise<string>;
  writeFile(context: IProjectContext, path: string, content: string): Promise<void>;
  stat(context: IProjectContext, path: string): Promise<IProjectFileEntry>;
  /** Resolve whether `path` is inside a git work tree; returns the root or null. */
  findGitRoot(context: IProjectContext, path: string): Promise<string | null>;
}

export const IProjectFsService = createIdentifier<IProjectFsService>(
  'project.project-fs-service'
);
