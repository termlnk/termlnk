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
 * 字段级 LWW 元数据（仅 config 资源使用）。
 *
 * 设计依据：cloud-sync-architecture.md §4.5。`config.value` 是嵌套 JSON——
 * 整行 LWW 会让两台设备互相覆盖未变更的字段，所以 config 走字段（subKey）级 LWW，
 * 其他规范化资源走 sync_row_meta。
 *
 * 字段：
 * - `field` — 业务上的 subKey（如 `electron-main.config` 下的 `mainWindowState`）
 * - `updatedAt` — 本地最近一次写入该字段的 epoch ms
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
