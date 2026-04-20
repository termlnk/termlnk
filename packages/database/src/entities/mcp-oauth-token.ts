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
import { mcpServerEntity } from './mcp-server';

export const mcpOAuthTokenEntity = sqliteTable('mcp_oauth_token', {
  id: text('id').primaryKey().notNull(),
  serverId: text('server_id').notNull().references(() => mcpServerEntity.id, { onDelete: 'cascade' }),
  authorizationServerUrl: text('authorization_server_url'),
  resourceUrl: text('resource_url'),
  clientId: text('client_id'),
  clientSecret: text('client_secret'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenType: text('token_type'),
  expiresAt: integer('expires_at'),
  scope: text('scope'),
  codeVerifier: text('code_verifier'),
  lastRefreshAt: text('last_refresh_at'),
  lastError: text('last_error'),
  ...timestamps,
}, (table) => [
  index('idx_server_id').on(table.serverId),
]);

export type IMcpOAuthTokenEntity = InferSelectModel<typeof mcpOAuthTokenEntity>;
export type IMcpOAuthTokenEntityInsert = InferInsertModel<typeof mcpOAuthTokenEntity>;
