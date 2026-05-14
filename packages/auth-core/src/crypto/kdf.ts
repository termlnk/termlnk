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

// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { hkdf } from '@noble/hashes/hkdf.js';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { sha256 } from '@noble/hashes/sha2.js';
import { base64ToBytes, HKDF_INFO, MASTER_KEY_DERIVATION } from '@termlnk/auth';

const TEXT_ENCODER = new TextEncoder();

// libsodium's `crypto_pwhash` hard-codes saltlen to 16 bytes; we must produce a fixed-length
// salt so the same derivation runs on both hash-wasm (desktop) and libsodium (mobile).
const KDF_SALT_INFO = 'termlnk.kdf.salt.v1';
const KDF_SALT_BYTES = 16;

export interface IDerivedSubKeys {
  readonly authKey: Uint8Array;
  readonly encKey: Uint8Array;
  readonly indexKey: Uint8Array;
}

// Produces the 16-byte Argon2id salt as `HKDF-SHA256(IKM=email, salt=serverSalt, info)`.
// HKDF gives us a deterministic, fixed-length compression of `(email, serverSalt)` while
// preserving cross-account isolation: different emails feed into different IKM, so two
// accounts on the same server salt still derive distinct master keys. Email is normalized
// (trim + lowercase) so case differences cannot derive different keys for the same login.
//
// History: prior to KDF v1 this returned `utf8(email) || base64decode(serverSalt)` —
// variable length, which broke under libsodium. The compression is a one-way function so
// the shape change requires a re-derivation; see KDF_VERSION.
export function computeArgon2Salt(email: string, saltB64: string): Uint8Array {
  const emailBytes = TEXT_ENCODER.encode(email.trim().toLowerCase());
  const serverSaltBytes = base64ToBytes(saltB64);
  if (serverSaltBytes.length === 0) {
    throw new Error('Argon2 salt material is empty: serverSaltB64 must decode to >= 1 byte');
  }
  return hkdf(sha256, emailBytes, serverSaltBytes, TEXT_ENCODER.encode(KDF_SALT_INFO), KDF_SALT_BYTES);
}

// Splits the master key into three independent sub-keys via HKDF-SHA256. The info labels
// provide domain separation; given authKey alone the server cannot derive enc/indexKey.
// `salt` defaults to empty; HKDF performs PRK extraction internally.
export function deriveSubKeys(masterKey: Uint8Array, salt: Uint8Array = new Uint8Array(0)): IDerivedSubKeys {
  return {
    authKey: hkdf(sha256, masterKey, salt, TEXT_ENCODER.encode(HKDF_INFO.AUTH), MASTER_KEY_DERIVATION.outputBytes),
    encKey: hkdf(sha256, masterKey, salt, TEXT_ENCODER.encode(HKDF_INFO.ENC), MASTER_KEY_DERIVATION.outputBytes),
    indexKey: hkdf(sha256, masterKey, salt, TEXT_ENCODER.encode(HKDF_INFO.INDEX), MASTER_KEY_DERIVATION.outputBytes),
  };
}

// Best-effort zeroing. V8 may keep copies elsewhere; this only shrinks the residual window.
export function zeroize(buf: Uint8Array | null | undefined): void {
  if (!buf) {
    return;
  }
  buf.fill(0);
}
