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

// Mirrors @termlnk/database's mcp_server table column-for-column so the row-level
// `mcp_server` sync payload round-trips between desktop and mobile unchanged. Columns
// stay untyped strings here because database-mobile does not depend on @termlnk/agent;
// JSON columns use json mode so payloads carry decoded values on both ends. The
// device-bound mcp_oauth_token table is intentionally absent — tokens never sync and
// mobile has no MCP runtime yet.
export const mcpServerEntity = sqliteTable('mcp_server', {
  id: text('id').primaryKey().notNull(),
  registryId: text('registry_id'),
  name: text('name').notNull(),
  description: text('description'),
  transport: text('transport').notNull(),
  config: text('config', { mode: 'json' }).notNull(),
  capabilities: text('capabilities', { mode: 'json' }),
  toolCount: integer('tool_count').notNull().default(0),
  resourceCount: integer('resource_count').notNull().default(0),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('disconnected'),
  lastError: text('last_error'),
  ...timestamps,
}, (table) => [
  index('idx_mcp_server_name').on(table.name),
]);

export type IMcpServerEntity = InferSelectModel<typeof mcpServerEntity>;
export type IMcpServerEntityInsert = InferInsertModel<typeof mcpServerEntity>;
