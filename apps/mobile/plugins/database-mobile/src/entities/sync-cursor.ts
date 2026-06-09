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
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Server-issued pull cursor, one row per resource type. Opaque base64 token the client
// echoes back for incremental pulls; deleting the row forces a full resync.
export const syncCursorEntity = sqliteTable('sync_cursor', {
  resource: text('resource').primaryKey().notNull().$type<SyncResourceId>(),
  cursor: text('cursor').notNull(),
  lastPulledAt: integer('last_pulled_at').notNull(),
});

export type ISyncCursorEntity = InferSelectModel<typeof syncCursorEntity>;
export type ISyncCursorEntityInsert = InferInsertModel<typeof syncCursorEntity>;
