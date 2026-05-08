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
import { blob, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * 待推送 mutation 队列（offline-first 持久化）。
 *
 * 设计依据：cloud-sync-architecture.md §4.5 + Replicache pendingMutations。
 *
 * 字段说明：
 * - `id` — 本地随机 ID（与业务表无关；仅为 PK）
 * - `clientMutId` — per-device 单调递增（服务端按 (clientId, clientMutId) 去重）
 * - `op` — `'upsert'` 或 `'delete'`
 * - `entityId` — 业务表的 id（config 资源下为 `key`）
 * - `payload` — 已用 SyncCryptoService 加密的字节流；delete 时为 null
 * - `baseVersion` — 写入时的本地观察版本（来自 sync_row_meta），首次创建为 null
 * - `createdAt` — epoch ms，FIFO 排序依据
 * - `retryCount` — 拒绝后重试次数
 *
 * 注意：payload 走 BLOB；其内部已含 `tmsync1:` 前缀 + nonce + ciphertext+tag——
 * 服务端拿到也解不开（零知识）。
 */
export const syncOutboxEntity = sqliteTable('sync_outbox', {
  id: text('id').primaryKey().notNull(),
  clientMutId: integer('client_mut_id').notNull(),
  resource: text('resource').notNull().$type<SyncResourceId>(),
  op: text('op').notNull().$type<'upsert' | 'delete'>(),
  entityId: text('entity_id').notNull(),
  payload: blob('payload', { mode: 'buffer' }),
  baseVersion: integer('base_version'),
  createdAt: integer('created_at').notNull(),
  retryCount: integer('retry_count').notNull().default(0),
}, (table) => [
  index('idx_sync_outbox_resource').on(table.resource),
  index('idx_sync_outbox_client_mut_id').on(table.clientMutId),
]);

export type ISyncOutboxEntity = InferSelectModel<typeof syncOutboxEntity>;
export type ISyncOutboxEntityInsert = InferInsertModel<typeof syncOutboxEntity>;
