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
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

export const aiChatSessionEntity = sqliteTable('ai_chat_session', {
  id: text('id').primaryKey().notNull(),
  title: text('title').notNull().default('New Chat'),
  providerId: text('provider_id'),
  modelId: text('model_id'),
  messageCount: integer('message_count').notNull().default(0),
  accessedAt: text('accessed_at').notNull().$defaultFn(() => new Date().toISOString()),
  ...timestamps,
});

export type IAiChatSessionEntity = InferSelectModel<typeof aiChatSessionEntity>;
export type IAiChatSessionEntityInsert = InferInsertModel<typeof aiChatSessionEntity>;
