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

/**
 * 同步层 E2EE 加密器（**仅主进程**）。
 *
 * 与 @termlnk/database 的 ISecretCipherService 区别：
 * - SecretCipher：本地 at-rest 加密（OS keystore 派生密钥；解决"SQLite 文件被偷"风险）
 * - SyncCipher：跨设备 E2EE（user master password 派生 encKey；解决"服务端零知识"目标）
 *
 * 加密原语：XChaCha20-Poly1305（@noble/ciphers）；24-byte 随机 nonce 抗碰撞。
 *
 * **双层加密语义**：本地敏感字段（host.credential 等）已经被 SecretCipher 加密成 `tmenc1:` 密文；
 * 同步层把整条记录（含 `tmenc1:` 密文）再用 SyncCipher 加密成 `tmsync1:` payload 上传——
 * 服务端拿到 `tmsync1:` 解不开（只有持 master key 的客户端能解），即使 SafeStorage key 泄漏，
 * 攻击者也只能读到本地 SQLite 不能解云端 payload。
 */
export interface ISyncCryptoService {
  /** 是否当前可用（master key unlocked）—— locked 时所有 encrypt/decrypt 抛错 */
  readonly available: boolean;

  /**
   * 加密任意字节（mutation payload / patch item）。
   * @returns `tmsync1:`-prefixed 密文字节流（含 version + nonce + ciphertext + tag）
   */
  encrypt(plaintext: Uint8Array): Uint8Array;

  /**
   * 解密 `tmsync1:` 密文。
   * 失败抛错（key 错误 / 损坏 / 不支持版本）；调用方应捕获并标记 'cipher_mismatch' 错误。
   */
  decrypt(ciphertext: Uint8Array): Uint8Array;

  /**
   * 用 indexKey 对值做 HMAC，生成可索引但不可逆的标识。
   * 服务端可按此 hash 索引但永不见明文。
   */
  hmacIndex(value: string): Uint8Array;
}

export const ISyncCryptoService = createIdentifier<ISyncCryptoService>('sync.crypto-service');
