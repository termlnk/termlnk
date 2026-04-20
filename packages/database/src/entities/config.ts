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
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

export const configEntity = sqliteTable('config', {
  key: text('key').primaryKey().notNull(),
  value: text('value', { mode: 'json' }),
  ...timestamps,
});

export type IConfigEntity = InferSelectModel<typeof configEntity>;
export type IConfigEntityInsert = InferInsertModel<typeof configEntity>;
