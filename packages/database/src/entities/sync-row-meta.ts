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
 * 行级同步元数据。
 *
 * 每个被同步的业务表行（host / ai_provider / mcp_server / skill / config）
 * 对应一行——记录服务端为该行分配的 monotonic version，让客户端写入时能携带 baseVersion
 * 给服务端做乐观并发检查。
 *
 * - 不存 entity 数据本身（业务表已有），只存"我现在认为服务端的版本号是多少"
 * - 列 `version` 是服务端权威值；本地仅做乐观读取
 * - 列 `updated_at` 是 epoch ms，记录本地最近一次本地写入时间（区别于业务表的 ISO updated_at）
 */
export const syncRowMetaEntity = sqliteTable('sync_row_meta', {
  resource: text('resource').notNull().$type<SyncResourceId>(),
  entityId: text('entity_id').notNull(),
  version: integer('version').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.resource, table.entityId] }),
]);

export type ISyncRowMetaEntity = InferSelectModel<typeof syncRowMetaEntity>;
export type ISyncRowMetaEntityInsert = InferInsertModel<typeof syncRowMetaEntity>;
