/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ISnippetEntity } from '@termlnk/database-mobile';
import { DEFAULT_SNIPPET_ROOT } from '@termlnk/database-mobile';

export interface IGroupedSnippets {
  ungrouped: ISnippetEntity[];
  byPackage: Map<string, ISnippetEntity[]>;
}

export function groupSnippets(snippets: readonly ISnippetEntity[]): IGroupedSnippets {
  const byPackage = new Map<string, ISnippetEntity[]>();
  const ungrouped: ISnippetEntity[] = [];
  for (const s of snippets) {
    if (s.pid === DEFAULT_SNIPPET_ROOT) {
      ungrouped.push(s);
    } else {
      const list = byPackage.get(s.pid) || [];
      list.push(s);
      byPackage.set(s.pid, list);
    }
  }
  return { byPackage, ungrouped };
}

export function filterSnippets(snippets: readonly ISnippetEntity[], search: string): readonly ISnippetEntity[] {
  if (!search.trim()) {
    return snippets;
  }
  const q = search.toLowerCase();
  return snippets.filter((s) =>
    s.label.toLowerCase().includes(q)
    || (s.content ?? '').toLowerCase().includes(q)
  );
}
