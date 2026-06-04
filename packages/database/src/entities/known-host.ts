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

// All columns are public host-key material; nothing here is a secret.
export const knownHostEntity = sqliteTable('known_host', {
  id: text('id').primaryKey().notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull().default(22),
  keyType: text('key_type').notNull(),
  fingerprint: text('fingerprint').notNull(),
  publicKey: text('public_key'),
  lastSeenAt: text('last_seen_at'),

  ...timestamps,
}, (table) => [
  index('idx_known_host_lookup').on(table.host, table.port),
]);

export type IKnownHostEntity = InferSelectModel<typeof knownHostEntity>;
export type IKnownHostEntityInsert = InferInsertModel<typeof knownHostEntity>;
