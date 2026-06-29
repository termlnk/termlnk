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
import { aiChatSessionEntity } from './ai-chat-session';
import { timestamps } from './base';

export const aiChatMessageEntity = sqliteTable('ai_chat_message', {
  id: text('id').primaryKey().notNull(),
  sessionId: text('session_id').notNull().references(() => aiChatSessionEntity.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  parts: text('parts').notNull(),
  usage: text('usage'),
  sortOrder: integer('sort_order').notNull(),
  ...timestamps,
}, (t) => [
  index('idx_ai_chat_message_session').on(t.sessionId, t.sortOrder),
]);

export type IAiChatMessageEntity = InferSelectModel<typeof aiChatMessageEntity>;
export type IAiChatMessageEntityInsert = InferInsertModel<typeof aiChatMessageEntity>;
