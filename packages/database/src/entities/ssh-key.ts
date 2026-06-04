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

import type { SshKeyAlgorithm, SshKeySource } from '@termlnk/terminal';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './base';

export const sshKeyEntity = sqliteTable('ssh_key', {
  id: text('id').primaryKey().notNull(),
  label: text('label').notNull(),
  algorithm: text('algorithm').notNull().$type<SshKeyAlgorithm>(),
  bits: integer('bits'),

  privateKey: text('private_key').notNull(), // encrypted
  publicKey: text('public_key').notNull(),
  certificate: text('certificate'),
  passphrase: text('passphrase'), // encrypted
  savePassphrase: integer('save_passphrase', { mode: 'boolean' }).notNull().default(false),

  source: text('source').notNull().$type<SshKeySource>(),
  publicKeyFingerprint: text('public_key_fingerprint'),

  ...timestamps,
});

export type ISshKeyEntity = InferSelectModel<typeof sshKeyEntity>;
export type ISshKeyEntityInsert = InferInsertModel<typeof sshKeyEntity>;
