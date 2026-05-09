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
import { argon2id } from 'hash-wasm';

const TEXT_ENCODER = new TextEncoder();

export interface IDerivedSubKeys {
  readonly authKey: Uint8Array;
  readonly encKey: Uint8Array;
  readonly indexKey: Uint8Array;
}

// Composes the Argon2id input salt as `utf8(lowercased(email)) || base64decode(saltB64)`.
// Including the email gives "same password, different account -> different master key" so
// dictionary attacks across accounts do not amortize. The random server-side component
// guarantees first-time entropy. Email is normalized (trim + lowercase) so case differences
// cannot derive different keys for the same login.
export function computeArgon2Salt(email: string, saltB64: string): Uint8Array {
  const emailBytes = TEXT_ENCODER.encode(email.trim().toLowerCase());
  const serverSaltBytes = base64ToBytes(saltB64);
  if (serverSaltBytes.length === 0) {
    throw new Error('Argon2 salt material is empty: serverSaltB64 must decode to >= 1 byte');
  }
  const out = new Uint8Array(emailBytes.length + serverSaltBytes.length);
  out.set(emailBytes, 0);
  out.set(serverSaltBytes, emailBytes.length);
  return out;
}

// Argon2id stretch using OWASP-baseline parameters from `@termlnk/auth`. Runs via WASM
// for cross-platform parity. Callers must drop the password reference once this returns.
export async function deriveMasterKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return await argon2id({
    password,
    salt,
    parallelism: MASTER_KEY_DERIVATION.parallelism,
    iterations: MASTER_KEY_DERIVATION.iterations,
    memorySize: MASTER_KEY_DERIVATION.memoryKiB,
    hashLength: MASTER_KEY_DERIVATION.outputBytes,
    outputType: 'binary',
  });
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
