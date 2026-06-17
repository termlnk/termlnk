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

// Per-row sync metadata. One row per synced business row; records the server-assigned
// monotonic version for optimistic concurrency on push.
export const syncRowMetaEntity = sqliteTable('sync_row_meta', {
  resource: text('resource').notNull().$type<SyncResourceId>(),
  entityId: text('entity_id').notNull(),
  version: integer('version').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.resource, t.entityId] }),
]);

export type ISyncRowMetaEntity = InferSelectModel<typeof syncRowMetaEntity>;
export type ISyncRowMetaEntityInsert = InferInsertModel<typeof syncRowMetaEntity>;
