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

export const AUTH_PLUGIN_NAME = 'AUTH_PLUGIN';
export const AUTH_PLUGIN_CONFIG_KEY = 'auth.config';

// Argon2id master key derivation parameters (OWASP 2023 baseline for password hashing).
// Some libraries call `iterations` `timeCost` or `opsLimit` — same field.
export const MASTER_KEY_DERIVATION = {
  memoryKiB: 65_536,
  iterations: 3,
  parallelism: 4,
  // Output length before HKDF splits it into auth/enc/index sub-keys.
  outputBytes: 32,
} as const;

// HKDF info labels providing domain separation between the three sub-keys derived from the
// master key. The server-stored `auth` hash cannot be reversed into local-only enc/index.
export const HKDF_INFO = {
  AUTH: 'termlnk.auth.v1',
  ENC: 'termlnk.enc.v1',
  INDEX: 'termlnk.index.v1',
} as const;
