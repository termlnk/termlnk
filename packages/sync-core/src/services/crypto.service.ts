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
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { IMasterKeyService as IMasterKeyServiceId, randomBytes } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { SYNC_PAYLOAD_PREFIX } from '@termlnk/sync';

const TEXT_ENCODER = new TextEncoder();

const PREFIX_BYTES = TEXT_ENCODER.encode(SYNC_PAYLOAD_PREFIX);
const NONCE_LEN = 24;
const POLY1305_TAG_LEN = 16;

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
    if (!PREFIX_BYTES.every((b, i) => payload[i] === b)) {
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
