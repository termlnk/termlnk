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

import type { IKeypair } from '../models/keypair';
import { createIdentifier } from '@termlnk/core';

/**
 * Owner-side long-term X25519 keypair (P5.5.3).
 *
 * Persistence rules:
 *   - secret key: written to local SQLite via ConfigRepository.setField as a
 *     base64url-encoded plaintext wrapped by ISecretCipherService (`tmenc1:` prefix).
 *   - public key: stored unencrypted (it's intended for invitees to see).
 *
 * Lazy semantics: the first call to `getOrCreate()` triggers a keygen + persist.
 * Subsequent reads come from an in-memory cache. The service is renderer-aware
 * via DI but only the main process is expected to instantiate it (better-sqlite3).
 */
export interface IDaemonKeypairService {
  /** Generate the keypair on first use; reuse persisted bytes on subsequent calls. */
  getOrCreate(): Promise<IKeypair>;

  /** Just the public half — safe to expose anywhere (including the renderer). */
  getPublicKey(): Promise<Uint8Array>;

  /**
   * Destroy the persisted keypair AND in-memory cache. Used when re-keying
   * after suspected compromise; callers must invalidate every outstanding
   * invite afterwards (those rely on the old daemon pub).
   */
  rotate(): Promise<IKeypair>;
}

export const IDaemonKeypairService = createIdentifier<IDaemonKeypairService>(
  'shared-terminal.daemon-keypair.service'
);

/** Subkey under SHARED_TERMINAL_PLUGIN_CONFIG_KEY that holds the persisted keypair. */
export const DAEMON_KEYPAIR_CONFIG_SUBKEY = 'daemonKeypair';

/**
 * Wire shape stored at SHARED_TERMINAL_PLUGIN_CONFIG_KEY['daemonKeypair'].
 * Both fields are base64url-encoded byte sequences. `secretKeyCipher` is
 * additionally wrapped by ISecretCipherService.
 */
export interface IPersistedDaemonKeypair {
  readonly publicKeyB64: string;
  readonly secretKeyCipher: string;
  /** ms epoch — useful for rotation audit. */
  readonly createdAt: number;
}
