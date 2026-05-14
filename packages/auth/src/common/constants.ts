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

export const AUTH_PLUGIN_CONFIG_KEY = 'auth.config';

// Key under which auth-core persists the stable per-device identifier through
// IAuthKeyValueStorage. The value is a nanoid generated on first sign-in / register;
// it is sent on every subsequent auth request so the server can deduplicate session
// rows for the same physical device. Resetting it (logout + clear storage) materialises
// as a brand-new device in the user's device list.
export const AUTH_DEVICE_ID_STORAGE_KEY = 'device-id';

// Argon2id master key derivation parameters (aligned with OWASP 2024 baseline).
// Some libraries call `iterations` `timeCost` or `opsLimit` — same field.
//
// `parallelism = 1` is forced by libsodium's `crypto_pwhash` (which the mobile target uses
// via JSI). Bumping it would require dropping libsodium in favour of a custom PHC binding —
// see the cross-platform KDF research recorded alongside this constant.
export const MASTER_KEY_DERIVATION = {
  memoryKiB: 65_536,
  iterations: 3,
  parallelism: 1,
  // Output length before HKDF splits it into auth/enc/index sub-keys.
  outputBytes: 32,
} as const;

// Bumped whenever MASTER_KEY_DERIVATION or computeArgon2Salt change in a way that breaks
// existing derivations. Persisted next to the server salt so older accounts can re-derive
// against their original parameter set during a migration window.
export const KDF_VERSION = 1;

// HKDF info labels providing domain separation between the three sub-keys derived from the
// master key. The server-stored `auth` hash cannot be reversed into local-only enc/index.
export const HKDF_INFO = {
  AUTH: 'termlnk.auth.v1',
  ENC: 'termlnk.enc.v1',
  INDEX: 'termlnk.index.v1',
} as const;
