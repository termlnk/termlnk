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
import type { IMobileHostType } from '../types';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

// Mobile schema differs from desktop @termlnk/database: credential/proxy are stored
// as opaque ciphertext columns (`_ct`) sealed by MobileSecretCipherService instead of
// inline JSON with selective-field masking. settings / hostChainIds stay as plaintext
// JSON columns since they carry no secrets.
export const hostEntity = sqliteTable('hosts', {
  id: text('id').primaryKey().notNull(),
  pid: text('pid').notNull().default('root'),
  tree: text('tree'),
  label: text('label').notNull(),
  type: text('type').notNull().$type<IMobileHostType>(),
  addr: text('addr'),
  port: integer('port'),
  sort: integer('sort').notNull().default(0),
  credentialCt: text('credential_ct'),
  proxyCt: text('proxy_ct'),
  settingsJson: text('settings_json'),
  hostChainIdsJson: text('host_chain_ids_json'),
  ...timestamps,
}, (t) => [
  index('idx_hosts_pid').on(t.pid),
  index('idx_hosts_sort').on(t.sort),
]);

export type IHostEntity = InferSelectModel<typeof hostEntity>;
export type IHostEntityInsert = InferInsertModel<typeof hostEntity>;
