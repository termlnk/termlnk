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
import type { ISnippet, ISnippetChangeEvent, ISnippetPackage, ISnippetUpdate, SnippetItem, SnippetTree } from '../models/snippet';
import { createIdentifier } from '@termlnk/core';

export interface ISnippetService {
  getAll(): Promise<ISnippet[]>;
  getById(id: string): Promise<ISnippet | undefined>;
  getItem(id: string): Promise<SnippetItem | undefined>;
  getChildrenList(pid: string): Promise<SnippetItem[]>;
  create(snippet: Omit<ISnippet, 'id' | 'type'>): Promise<string>;
  update(id: string, updates: ISnippetUpdate): Promise<void>;
  delete(id: string): Promise<void>;

  getAllPackages(): Promise<ISnippetPackage[]>;
  getPackageById(id: string): Promise<ISnippetPackage | undefined>;
  createPackage(pkg: Pick<ISnippetPackage, 'label' | 'pid'> & { sort?: number }): Promise<string>;
  updatePackage(id: string, updates: Partial<Omit<ISnippetPackage, 'id' | 'type'>>): Promise<void>;
  deletePackage(id: string): Promise<void>;
  getExpandedPackageIds(): Promise<string[]>;
  setExpandedPackageIds(ids: string[]): Promise<void>;

  getTree(): Promise<SnippetTree[]>;
  move(id: string, targetPid: string, targetSort: number): Promise<void>;

  paste(sessionId: string, content: string): Promise<void>;
  run(sessionId: string, content: string): Promise<void>;

  onChanged$(): Observable<ISnippetChangeEvent>;
}
export const ISnippetService = createIdentifier<ISnippetService>('snippet.snippet-service');
