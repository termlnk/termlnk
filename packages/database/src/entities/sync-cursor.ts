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

/**
 * 每个资源类型一行的服务端拉取游标。
 *
 * `cursor` 是服务端 opaque 字符串（base64）——客户端不解析其内容，仅照搬回去用于增量拉取。
 * `lastPulledAt` 是本地 epoch ms，方便 UI 展示"最近同步时间"，也用作离线超时判断。
 *
 * 一台设备的 forceFullResync 操作 = 本表对应 row 删除（cursor 视作 null = 重头拉）。
 */
export const syncCursorEntity = sqliteTable('sync_cursor', {
  resource: text('resource').primaryKey().notNull().$type<SyncResourceId>(),
  cursor: text('cursor').notNull(),
  lastPulledAt: integer('last_pulled_at').notNull(),
});

export type ISyncCursorEntity = InferSelectModel<typeof syncCursorEntity>;
export type ISyncCursorEntityInsert = InferInsertModel<typeof syncCursorEntity>;
