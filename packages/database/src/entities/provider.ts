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

// Provider user config (delta only)
export const aiProviderEntity = sqliteTable('ai_provider', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  builtin: integer('builtin', { mode: 'boolean' }).notNull().default(false),
  api: text('api'),
  apiKey: text('api_key'),
  baseUrl: text('base_url'),
  headers: text('headers', { mode: 'json' }),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
});

export type IAIProviderEntity = InferSelectModel<typeof aiProviderEntity>;
export type IAIProviderEntityInsert = InferInsertModel<typeof aiProviderEntity>;

// Model user config (delta only)
export const aiProviderModelEntity = sqliteTable('ai_provider_model', {
  id: text('id').primaryKey().notNull(),
  providerId: text('provider_id').notNull(),
  modelId: text('model_id').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  overrides: text('overrides', { mode: 'json' }),
  ...timestamps,
}, (table) => [
  index('idx_provider_model_provider_id').on(table.providerId),
]);

export type IAIProviderModelEntity = InferSelectModel<typeof aiProviderModelEntity>;
export type IAIProviderModelEntityInsert = InferInsertModel<typeof aiProviderModelEntity>;

// Custom model full definition (non-built-in only)
export const aiCustomModelEntity = sqliteTable('ai_custom_model', {
  id: text('id').primaryKey().notNull(),
  providerId: text('provider_id').notNull(),
  modelId: text('model_id').notNull(),
  name: text('name').notNull(),
  api: text('api'),
  baseUrl: text('base_url'),
  reasoning: integer('reasoning', { mode: 'boolean' }).notNull().default(false),
  inputModes: text('input_modes', { mode: 'json' }).notNull().default(['text']),
  cost: text('cost', { mode: 'json' }),
  contextWindow: integer('context_window').notNull().default(128000),
  maxTokens: integer('max_tokens').notNull().default(16384),
  headers: text('headers', { mode: 'json' }),
  compat: text('compat', { mode: 'json' }),
  sort: integer('sort').notNull().default(0),
  ...timestamps,
}, (table) => [
  index('idx_custom_model_provider_id').on(table.providerId),
]);

export type IAICustomModelEntity = InferSelectModel<typeof aiCustomModelEntity>;
export type IAICustomModelEntityInsert = InferInsertModel<typeof aiCustomModelEntity>;
