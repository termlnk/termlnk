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

export const chatSessionEntity = sqliteTable('chat_session', {
  id: text('id').primaryKey().notNull(),
  title: text('title').notNull().default('New Chat'),
  modelProvider: text('model_provider'),
  modelId: text('model_id'),
  systemPrompt: text('system_prompt'),
  thinkingLevel: text('thinking_level'),
  selectedSkillIds: text('selected_skill_ids', { mode: 'json' }).$type<string[]>(),
  selectedToolIds: text('selected_tool_ids', { mode: 'json' }).$type<string[]>(),
  messageCount: integer('message_count').notNull().default(0),
  ...timestamps,
});

export type IChatSessionEntity = InferSelectModel<typeof chatSessionEntity>;
export type IChatSessionEntityInsert = InferInsertModel<typeof chatSessionEntity>;

export const chatMessageEntity = sqliteTable('chat_message', {
  id: text('id').primaryKey().notNull(),
  sessionId: text('session_id').notNull().references(() => chatSessionEntity.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system' | 'compact_boundary'
  content: text('content').notNull().default(''),
  thinking: text('thinking'),
  toolCalls: text('tool_calls', { mode: 'json' }),
  error: text('error'),
  usage: text('usage', { mode: 'json' }),
  compactMetadata: text('compact_metadata', { mode: 'json' }),
  hiddenInUI: integer('hidden_in_ui', { mode: 'boolean' }),
  sortOrder: integer('sort_order').notNull(),
  ...timestamps,
}, (table) => [
  index('idx_session_id').on(table.sessionId),
  index('idx_message_sort').on(table.sessionId, table.sortOrder),
]);

export type IChatMessageEntity = InferSelectModel<typeof chatMessageEntity>;
export type IChatMessageEntityInsert = InferInsertModel<typeof chatMessageEntity>;
