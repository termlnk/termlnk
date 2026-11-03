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

import type { Buffer } from 'node:buffer';
import { pbkdf2Sync } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { AesGcmSecretCipher } from './aes-gcm.cipher';

// Cross-platform fallback cipher. Master key is derived from a device fingerprint
// (hostname + username), so an SQLite copy moved to another machine cannot be decrypted.
// This is strictly a hardening step over plaintext storage, not a substitute for
// an OS-managed keystore.
export class LocalDerivedSecretCipher extends AesGcmSecretCipher {
  constructor(masterKey?: Buffer) {
    super('local-derived', masterKey ?? _deriveKeyFromDevice());
  }
}

function _deriveKeyFromDevice(): Buffer {
  const fingerprint = `${hostname()}|${userInfo().username}|termlnk-local-derived-v1`;
  // Salt is fixed because the input is already a device fingerprint, not a user password;
  // PBKDF2 here is used purely to expand the fingerprint into a uniform 256-bit key.
  return pbkdf2Sync(fingerprint, 'termlnk-secret-cipher-v1', 100_000, 32, 'sha256');
}
