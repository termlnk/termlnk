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

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

export const aiProviderEntity = sqliteTable('ai_provider', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  builtin: integer('builtin', { mode: 'boolean' }).notNull().default(false),
  api: text('api'),
  apiKey: text('api_key'),
  baseUrl: text('base_url'),
  // json mode mirrors the desktop schema so sync payloads carry decoded values on
  // both ends; a raw-string column here made desktop double-encode on write-back.
  headers: text('headers', { mode: 'json' }),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
});

export type IAiProviderEntity = InferSelectModel<typeof aiProviderEntity>;
export type IAiProviderEntityInsert = InferInsertModel<typeof aiProviderEntity>;
