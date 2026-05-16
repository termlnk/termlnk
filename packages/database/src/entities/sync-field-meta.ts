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

import type { SyncResourceId } from '@termlnk/sync';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Field-level LWW metadata (config resource only).
 *
 * `config.value` is nested JSON, so row-level LWW would let two devices
 * clobber each other's unrelated subKeys. Config uses per-subKey LWW; other
 * normalized resources stay on sync_row_meta. See cloud-sync-architecture.md §4.5.
 *
 * `field` is the business subKey (e.g. `mainWindowState` under
 * `electron-main.config`); `updatedAt` is local epoch ms of the last write.
 */
export const syncFieldMetaEntity = sqliteTable('sync_field_meta', {
  resource: text('resource').notNull().$type<SyncResourceId>(),
  entityId: text('entity_id').notNull(),
  field: text('field').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.resource, table.entityId, table.field] }),
]);

export type ISyncFieldMetaEntity = InferSelectModel<typeof syncFieldMetaEntity>;
export type ISyncFieldMetaEntityInsert = InferInsertModel<typeof syncFieldMetaEntity>;
