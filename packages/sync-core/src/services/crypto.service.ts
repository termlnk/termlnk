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

import type { IMasterKey, IMasterKeyService } from '@termlnk/auth';
import type { ISyncCryptoService } from '@termlnk/sync';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/ciphers 2.x exports only `.js` subpaths
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { hmac } from '@noble/hashes/hmac.js';
// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/hashes 2.x exports only `.js` subpaths
import { sha256 } from '@noble/hashes/sha2.js';
import { IMasterKeyService as IMasterKeyServiceId, randomBytes } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { SYNC_PAYLOAD_PREFIX } from '@termlnk/sync';

const TEXT_ENCODER = new TextEncoder();

/**
 * Magic header for the ciphertext frame: the ASCII bytes of `tmsync1:`.
 *
 * Distinguishes sync E2EE frames from local SafeStorage frames (`tmenc1:`),
 * so an unknown blob can be routed to the right cipher by prefix.
 */
const PREFIX_BYTES = TEXT_ENCODER.encode(SYNC_PAYLOAD_PREFIX);

/** XChaCha20 nonce length (bytes). */
const NONCE_LEN = 24;

/** Poly1305 authentication tag length (bytes). */
const POLY1305_TAG_LEN = 16;

/**
 * Sync-layer E2EE cipher.
 *
 * Frame layout:
 * ```
 *   [PREFIX_BYTES (8)] [nonce (24)] [ciphertext + tag]
 * ```
 *
 * Contract:
 * - When the master key is locked, every operation throws — callers must
 *   never treat a missing key as silent success.
 * - Callers should check `available === true` up front, or translate the
 *   exception into the `cipher_mismatch` / `master_key_locked` error code.
 *
 * Boundary vs. `ISecretCipherService`:
 * - SecretCipher (`tmenc1:`): local at-rest; key from OS keystore / device
 *   fingerprint; defends against "SQLite file stolen".
 * - SyncCryptoService (`tmsync1:`): cross-device E2EE; key derived from the
 *   user master password; defends against a curious server.
 * - Defense in depth: sensitive fields are first wrapped in `tmenc1:` for
 *   local storage, then the whole row is wrapped in `tmsync1:` for upload.
 */
export class SyncCryptoService extends Disposable implements ISyncCryptoService {
  constructor(
    @Inject(IMasterKeyServiceId) private readonly _masterKeyService: IMasterKeyService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  get available(): boolean {
    return this._masterKeyService.getCurrent() !== null;
  }

  encrypt(plaintext: Uint8Array): Uint8Array {
    const key = this._requireKey();
    const nonce = new Uint8Array(randomBytes(NONCE_LEN));
    const sealed = xchacha20poly1305(key.encKey, nonce).encrypt(plaintext);

    const out = new Uint8Array(PREFIX_BYTES.length + nonce.length + sealed.length);
    out.set(PREFIX_BYTES, 0);
    out.set(nonce, PREFIX_BYTES.length);
    out.set(sealed, PREFIX_BYTES.length + nonce.length);
    return out;
  }

  decrypt(payload: Uint8Array): Uint8Array {
    const key = this._requireKey();

    if (payload.length < PREFIX_BYTES.length + NONCE_LEN + POLY1305_TAG_LEN) {
      throw new Error('[SyncCryptoService] payload too short to be a valid tmsync1 frame');
    }
    if (!startsWithBytes(payload, PREFIX_BYTES)) {
      throw new Error('[SyncCryptoService] payload missing tmsync1: prefix');
    }

    const nonce = payload.subarray(PREFIX_BYTES.length, PREFIX_BYTES.length + NONCE_LEN);
    const sealed = payload.subarray(PREFIX_BYTES.length + NONCE_LEN);
    // @noble/ciphers throws on Poly1305 verification failure; let it propagate.
    return xchacha20poly1305(key.encKey, nonce).decrypt(sealed);
  }

  hmacIndex(value: string): Uint8Array {
    const key = this._requireKey();
    return hmac(sha256, key.indexKey, TEXT_ENCODER.encode(value));
  }

  private _requireKey(): IMasterKey {
    const key = this._masterKeyService.getCurrent();
    if (key === null) {
      this._logService.warn('[SyncCryptoService] crypto requested while master key is locked');
      throw new Error('[SyncCryptoService] master key is locked');
    }
    return key;
  }
}

function startsWithBytes(buf: Uint8Array, prefix: Uint8Array): boolean {
  if (buf.length < prefix.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (buf[i] !== prefix[i]) {
      return false;
    }
  }
  return true;
}
