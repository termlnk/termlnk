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
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Mobile-only table (not synced). Composite primary key allows a single host to keep
// independent terminal / sftp last-used timestamps without colliding on insert.
export const recentSessionEntity = sqliteTable('recent_sessions', {
  hostId: text('host_id').notNull(),
  kind: text('kind').notNull().$type<'terminal' | 'sftp'>(),
  lastUsedAt: integer('last_used_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.hostId, t.kind] }),
  index('idx_recent_sessions_last_used_at').on(t.lastUsedAt),
]);

export type IRecentSessionEntity = InferSelectModel<typeof recentSessionEntity>;
export type IRecentSessionEntityInsert = InferInsertModel<typeof recentSessionEntity>;
