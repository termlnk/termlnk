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
 * `tmsync1:` 字面量编码为 ASCII 字节，作为密文 frame 的 magic header。
 *
 * 与本地 SafeStorage 加密的 `tmenc1:` 区分：调用方拿到陌生字节流时
 * 可凭前缀判断是该走 sync E2EE 还是 secret-cipher 路径。
 */
const PREFIX_BYTES = TEXT_ENCODER.encode(SYNC_PAYLOAD_PREFIX);

/** XChaCha20 标准 nonce 长度（24 字节）。 */
const NONCE_LEN = 24;

/** Poly1305 认证 tag 长度（16 字节）。 */
const POLY1305_TAG_LEN = 16;

/**
 * 同步层 E2EE 加密器实现。
 *
 * Frame 布局：
 * ```
 *   [PREFIX_BYTES (8)] [nonce (24)] [ciphertext + tag]
 * ```
 *
 * 调用约定：
 * - master key locked 时所有 encrypt/decrypt/hmacIndex 抛错（避免业务方误把空数据当成"成功"）
 * - 上层应在调用前先确认 `available === true`，或捕获异常转化为 `cipher_mismatch` / `master_key_locked` 错误码
 *
 * 与 ISecretCipherService 的边界（明示）：
 * - SecretCipher：本地 at-rest（`tmenc1:`），密钥来自 OS keystore / 设备指纹；保护"SQLite 文件被偷"
 * - SyncCryptoService：跨设备 E2EE（`tmsync1:`），密钥来自用户主密码；保护"服务端零知识"
 * - 双层加密：本地敏感字段先被 SecretCipher 加成 `tmenc1:`，再被 SyncCryptoService 整条加成 `tmsync1:` 上传
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
    // @noble/ciphers Poly1305 验证失败时抛错——我们直接透传即可
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
