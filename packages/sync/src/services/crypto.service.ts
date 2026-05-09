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

import { createIdentifier } from '@termlnk/core';

// Sync-layer E2EE cipher (main-process only). Distinct from @termlnk/database's
// SecretCipher: that one defends "stolen SQLite file" by deriving a key from the OS
// keystore; this one defends "server zero-knowledge" by deriving from the user's master
// password. Sensitive rows therefore travel double-encrypted — already `tmenc1:` at rest,
// then wrapped in `tmsync1:` for upload, so a leaked SafeStorage key still cannot decrypt
// cloud payloads.
//
// Algorithm: XChaCha20-Poly1305 with a 24-byte random nonce.
export interface ISyncCryptoService {
  // True only when the master key is unlocked; encrypt/decrypt throw otherwise.
  readonly available: boolean;

  // Returns a `tmsync1:`-prefixed byte stream (version + nonce + ciphertext + tag).
  encrypt(plaintext: Uint8Array): Uint8Array;

  // Throws on key mismatch / corruption / unsupported version; callers should map to
  // 'cipher_mismatch'.
  decrypt(ciphertext: Uint8Array): Uint8Array;

  // Server-indexable but irreversible identifier derived with the indexKey.
  hmacIndex(value: string): Uint8Array;
}

export const ISyncCryptoService = createIdentifier<ISyncCryptoService>('sync.crypto-service');
