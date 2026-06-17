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

import type { SnippetType } from '@termlnk/snippet';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

export const DEFAULT_SNIPPET_ROOT = 'root';

export const snippetEntity = sqliteTable('snippet', {
  id: text('id').primaryKey().notNull(),
  label: text('label').notNull(),
  type: text('type').notNull().$type<SnippetType>(),

  pid: text('pid').notNull().default(DEFAULT_SNIPPET_ROOT),
  tree: text('tree').notNull().default(''),

  // snippet-only (nullable for package rows)
  content: text('content'),
  description: text('description'),
  targetHostIds: text('target_host_ids', { mode: 'json' }).$type<string[]>(),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),

  // package-only
  expanded: integer('expanded', { mode: 'boolean' }).notNull().default(false),

  sort: integer('sort').notNull().default(0),
  ...timestamps,
}, (table) => [
  index('idx_snippet_pid').on(table.pid),
  index('idx_snippet_type').on(table.type),
]);

export type ISnippetEntity = InferSelectModel<typeof snippetEntity>;
export type ISnippetEntityInsert = InferInsertModel<typeof snippetEntity>;
