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
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

export const aiProviderModelEntity = sqliteTable('ai_provider_model', {
  id: text('id').primaryKey().notNull(),
  providerId: text('provider_id').notNull(),
  modelId: text('model_id').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  // json mode mirrors the desktop schema so sync payloads carry decoded values on
  // both ends; a raw-string column here made desktop double-encode on write-back.
  overrides: text('overrides', { mode: 'json' }),
  ...timestamps,
}, (table) => [
  index('idx_provider_model_provider_id').on(table.providerId),
]);

export type IAiProviderModelEntity = InferSelectModel<typeof aiProviderModelEntity>;
export type IAiProviderModelEntityInsert = InferInsertModel<typeof aiProviderModelEntity>;
