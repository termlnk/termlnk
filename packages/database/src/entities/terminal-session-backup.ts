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
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

/**
 * Singleton-row backup of the full terminal persistence state (sessions,
 * workspaces, tab order, active tab). Kept in its own table because the
 * serialized buffers can reach several MB — sharing the `config` row with
 * other small settings would make every config read pay the cost.
 */
export const terminalSessionBackupEntity = sqliteTable('terminal_session_backup', {
  id: text('id').primaryKey().notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  ...timestamps,
});

export type ITerminalSessionBackupEntity = InferSelectModel<typeof terminalSessionBackupEntity>;
export type ITerminalSessionBackupEntityInsert = InferInsertModel<typeof terminalSessionBackupEntity>;
