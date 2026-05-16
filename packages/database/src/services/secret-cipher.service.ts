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

// Marker for ciphertext payloads. Encrypted values look like
// `tmenc1:{base64-json}` where the JSON body is `{ scheme, iv?, ciphertext, tag? }`.
// Repositories rely on this prefix to skip already-encrypted values (idempotency).
export const SECRET_CIPHER_PREFIX = 'tmenc1:';

export type SecretCipherScheme =
  | 'safe-storage' // Electron safeStorage backed by the OS keystore
  | 'local-derived'; // Node crypto + device-fingerprint fallback

export interface ISecretCipherService {
  readonly scheme: SecretCipherScheme;

  isAvailable(): boolean;

  // Empty input is returned as-is; encrypted output always starts with SECRET_CIPHER_PREFIX.
  encrypt(plaintext: string): string;

  // Values without the prefix are treated as legacy plaintext and returned unchanged.
  decrypt(ciphertext: string): string;
}

export const ISecretCipherService = createIdentifier<ISecretCipherService>(
  'database.secret-cipher.service'
);

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(SECRET_CIPHER_PREFIX);
}
