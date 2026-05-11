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

import type { IKeypair, ISharedKey } from '../models/keypair';
import { createIdentifier } from '@termlnk/core';

/**
 * NaCl box (X25519 + XSalsa20-Poly1305) for the daemon ↔ relay ↔ client real-time channel.
 * Separate from SyncCryptoService (@noble/ciphers) and SecretCipherService (at-rest) so each
 * uses its own algorithm and key derivation path.
 */
export interface ISharedTerminalCryptoService {
  generateKeypair(): IKeypair;

  /** NaCl box.before — derive a 32-byte shared key for fast-path secretbox. */
  deriveSharedKey(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): ISharedKey;

  /** NaCl box for one-shot messages. Output: nonce(24) || ciphertext+tag. */
  box(plaintext: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;

  boxOpen(payload: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;

  /** NaCl secretbox — symmetric fast path. Output: nonce(24) || ciphertext+tag. */
  secretBox(plaintext: Uint8Array, sharedKey: ISharedKey): Uint8Array;

  secretBoxOpen(payload: Uint8Array, sharedKey: ISharedKey): Uint8Array;

  generateSessionKey(): Uint8Array;

  randomNonce(): Uint8Array;

  randomBytes(length: number): Uint8Array;
}

export const ISharedTerminalCryptoService = createIdentifier<ISharedTerminalCryptoService>(
  'shared-terminal.crypto-service'
);
