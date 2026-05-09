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
 * NaCl box 兼容 X25519 keypair——daemon 长期身份 + 客户端长期/临时身份共用此结构。
 *
 * - publicKey: 32 bytes
 * - secretKey: 32 bytes（**绝不出现在 daemon 进程之外**——除 ephemeral 私钥写入 invite fragment）
 *
 * 编码：daemon 持久化在 OS keychain；wire 上以 base64url 字符串传输。
 */
export interface IKeypair {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}

/**
 * 已派生的共享密钥——NaCl box.before（X25519 ECDH + HSalsa20）的输出。
 *
 * 32 bytes；后续 `secretbox(message, nonce, sharedKey)` 加密快路径用。
 */
export interface ISharedKey {
  readonly bytes: Uint8Array;
}
