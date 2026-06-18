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

export enum SnippetType {
  SNIPPET = 'snippet',
  PACKAGE = 'package',
}

export interface ISnippetItemBase {
  id: string;
  pid: string;
  label: string;
  type: SnippetType;
  sort: number;
}

export interface ISnippet extends ISnippetItemBase {
  type: SnippetType.SNIPPET;
  content: string;
  description?: string | null;
  targetHostIds?: string[] | null;
  favorite: boolean;
}

export interface ISnippetPackage extends ISnippetItemBase {
  type: SnippetType.PACKAGE;
  expanded: boolean;
}

export type SnippetItem = ISnippet | ISnippetPackage;

export type SnippetTree = SnippetItem & { children: SnippetTree[] };

export type ISnippetUpdate = Partial<Omit<ISnippet, 'id' | 'type'>>;

export const DEFAULT_SNIPPET_ROOT = 'root';

export interface ISnippetChangeEvent {
  readonly type: 'snippet' | 'package';
  readonly action: 'add' | 'update' | 'delete' | 'move';
  readonly id: string;
  readonly pid: string;
  readonly oldPid?: string;
}
