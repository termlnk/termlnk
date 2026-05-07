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

import type { HostType, ICredential, IHostSettings, IProxy } from '@termlnk/terminal';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

const DEFAULT_HOST_ROOT = 'root';

export const hostEntity = sqliteTable('host', {
  id: text('id').primaryKey().notNull(),
  label: text('label').notNull(),
  type: text('type').notNull().$type<HostType>(), // type: host / group

  pid: text('pid').notNull().default(DEFAULT_HOST_ROOT),
  tree: text('tree').notNull().default(''), // id tree: root_10_12_13

  // only host type
  addr: text('addr'),
  port: integer('port'),
  credential: text('credential', { mode: 'json' }).$type<ICredential>(),
  proxy: text('proxy', { mode: 'json' }).$type<IProxy>(),
  settings: text('settings', { mode: 'json' }).$type<IHostSettings>(),
  hostChainIds: text('host_chain_ids', { mode: 'json' }).$type<string[]>(),
  sort: integer('sort').notNull().default(0),

  // only group type
  expanded: integer('expanded', { mode: 'boolean' }).notNull().default(false),

  ...timestamps,
}, (table) => [
  index('idx_pid').on(table.pid),
  index('idx_type').on(table.type),
]);

export type IHostEntity = InferSelectModel<typeof hostEntity>;
export type IHostEntityInsert = InferInsertModel<typeof hostEntity>;
