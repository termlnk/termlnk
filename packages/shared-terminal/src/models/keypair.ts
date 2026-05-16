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

/**
 * NaCl box-compatible X25519 keypair — used for the daemon's long-term
 * identity and for clients' long-term / ephemeral identities.
 *
 * - `publicKey`: 32 bytes
 * - `secretKey`: 32 bytes; **never leaves the daemon process**, except for
 *   ephemeral private keys that are baked into the invite URL fragment.
 *
 * Encoded as base64url on the wire; the daemon persists keys in the OS keychain.
 */
export interface IKeypair {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}

/**
 * Derived shared key — output of `NaCl box.before` (X25519 ECDH + HSalsa20).
 *
 * 32 bytes; used by the fast-path encryption (`secretbox(message, nonce, sharedKey)`).
 */
export interface ISharedKey {
  readonly bytes: Uint8Array;
}
