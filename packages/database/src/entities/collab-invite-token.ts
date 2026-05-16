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

/**
 * Owner-side persisted collaboration invite tokens (P5.5.2).
 *
 * Stores the full lifecycle of every cross-account invite the owner has minted: active,
 * consumed, revoked, expired. The cipher field holds the ephemeral X25519 private key
 * (URL-fragment material) encrypted via ISecretCipherService — losing the DB file must
 * not leak invite secrets.
 *
 * The PK is `invite_id` (base64url 24 bytes generated client-side) which mirrors the
 * same identifier surfaced to termlnk-server, so the lifecycle on either side can be
 * cross-referenced 1:1 without an opaque join column.
 */
export const collabInviteTokenEntity = sqliteTable('collab_invite_token', {
  /** base64url-encoded 24-byte random id; identical to the invite identifier on the relay/server side. */
  inviteId: text('invite_id').primaryKey().notNull(),
  sessionId: text('session_id').notNull(),
  /** SharedTerminalRole — kept as text to stay forward-compatible with new roles. */
  role: text('role').notNull(),
  /** sha256 of the canonical capability JSON; used by relay/server as opaque dedupe handle. */
  capabilityHash: text('capability_hash').notNull(),
  capabilityVersion: integer('capability_version').notNull(),
  capabilityNonce: text('capability_nonce').notNull(),
  /** base64url-encoded ephemeral X25519 public key. */
  ephPubB64: text('eph_pub_b64').notNull(),
  /** SecretCipher-encrypted base64url ephemeral X25519 private key (`tmenc1:` prefix). */
  ephPrivCipher: text('eph_priv_cipher').notNull(),
  /** ms epoch — capability.exp. */
  exp: integer('exp').notNull(),
  singleUse: integer('single_use', { mode: 'boolean' }).notNull(),
  /** 'active' | 'consumed' | 'revoked' | 'expired' */
  status: text('status').notNull(),
  /** Owner-supplied human label (optional). */
  note: text('note'),
  createdAt: integer('created_at').notNull(),
  consumedAt: integer('consumed_at'),
  revokedAt: integer('revoked_at'),
  /** When non-null, the create/revoke event has been confirmed by termlnk-server. */
  serverSyncedAt: integer('server_synced_at'),
}, (table) => [
  index('idx_collab_invite_token_status').on(table.status),
  index('idx_collab_invite_token_exp').on(table.exp),
  index('idx_collab_invite_token_session_id').on(table.sessionId),
]);

export type ICollabInviteTokenEntity = InferSelectModel<typeof collabInviteTokenEntity>;
export type ICollabInviteTokenEntityInsert = InferInsertModel<typeof collabInviteTokenEntity>;
