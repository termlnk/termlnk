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

// Mirrors @termlnk/database's skill table column-for-column so the row-level `skill`
// sync payload round-trips between desktop and mobile unchanged. `source` stays an
// untyped string (no @termlnk/agent dependency); `path` is stored relative to the
// per-source root exactly like desktop — absolute paths would break cross-device sync.
export const skillEntity = sqliteTable('skill', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  source: text('source').notNull(),
  registryId: text('registry_id'),
  version: text('version'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  checksum: text('checksum'),
  ...timestamps,
}, (table) => [
  index('idx_skill_name').on(table.name),
  index('idx_source').on(table.source),
]);

export type ISkillEntity = InferSelectModel<typeof skillEntity>;
export type ISkillEntityInsert = InferInsertModel<typeof skillEntity>;
