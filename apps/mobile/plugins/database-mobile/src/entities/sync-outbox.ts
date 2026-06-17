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
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { bytesBlob } from './base';

// Persistent pending-mutation queue (offline-first), mirrors @termlnk/database's
// desktop sync_outbox table row-for-row so the platform-agnostic sync engine
// behaves identically on both ends. `payload` uses a Uint8Array-native column
// type (see `bytesBlob` in ./base) because Hermes lacks the Node `Buffer` global
// that drizzle's stock `{ mode: 'buffer' }` mapper assumes.
export const syncOutboxEntity = sqliteTable('sync_outbox', {
  id: text('id').primaryKey().notNull(),
  clientMutId: integer('client_mut_id').notNull(),
  resource: text('resource').notNull().$type<SyncResourceId>(),
  op: text('op').notNull().$type<'upsert' | 'delete'>(),
  entityId: text('entity_id').notNull(),
  payload: bytesBlob('payload'),
  baseVersion: integer('base_version'),
  createdAt: integer('created_at').notNull(),
  retryCount: integer('retry_count').notNull().default(0),
}, (t) => [
  index('idx_sync_outbox_resource').on(t.resource),
  index('idx_sync_outbox_client_mut_id').on(t.clientMutId),
]);

export type ISyncOutboxEntity = InferSelectModel<typeof syncOutboxEntity>;
export type ISyncOutboxEntityInsert = InferInsertModel<typeof syncOutboxEntity>;
