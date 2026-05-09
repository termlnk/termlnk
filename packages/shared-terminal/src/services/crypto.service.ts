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
 * Shared-terminal 加密服务——基于 NaCl box（X25519 + XSalsa20-Poly1305）。
 *
 * 设计依据：cloud-sync-architecture.md §4.2 加密库选型 + §5.2 配对加密通道。
 * paseo 已实证 NaCl box 在 QR 配对场景比 Argon2id+XChaCha 更简洁。
 *
 * **职责拆分**：
 * - SyncCryptoService（@termlnk/sync）：跨设备 E2EE 同步配置；@noble/ciphers XChaCha20
 * - SharedTerminalCryptoService（本服务）：daemon ↔ relay ↔ client 实时通道；NaCl box
 * - SecretCipherService（@termlnk/database）：本地 at-rest；safeStorage / 派生 key
 *
 * 三者使用不同算法/不同密钥派生路径，互不影响——分别解决"零知识同步"
 * "P2P E2EE 实时通道""本地静态加密"三个独立威胁。
 *
 * **接口设计原则**：契约层只声明，不绑定 tweetnacl-js / libsodium 等具体实现；
 * 实现在 @termlnk/shared-terminal-core（P5.2 阶段）。
 */
export interface ISharedTerminalCryptoService {
  /**
   * 生成长期 keypair——daemon 启动 / 客户端首次配对时调用。
   * 返回 publicKey/secretKey 各 32 bytes。
   */
  generateKeypair(): IKeypair;

  /**
   * NaCl box.before：从对方公钥 + 自己私钥派生 32-byte 共享密钥。
   * 后续帧加密走 secretbox(sharedKey, nonce) 快路径。
   */
  deriveSharedKey(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): ISharedKey;

  /**
   * NaCl box（authenticated public-key encryption）。
   * 不需要预先 deriveSharedKey；适合一次性消息（如 pair_hello）。
   *
   * 输出布局：nonce(24) || ciphertext+tag。
   */
  box(plaintext: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;

  /**
   * NaCl box.open ——与 box() 互逆。失败抛错（密钥错 / 损坏 / 篡改）。
   */
  boxOpen(payload: Uint8Array, theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array;

  /**
   * NaCl secretbox（authenticated symmetric encryption）。
   * 用 deriveSharedKey 输出的 32-byte 密钥；走快路径不重复派生。
   *
   * 输出布局：nonce(24) || ciphertext+tag。
   */
  secretBox(plaintext: Uint8Array, sharedKey: ISharedKey): Uint8Array;

  /**
   * NaCl secretbox.open ——与 secretBox() 互逆。
   */
  secretBoxOpen(payload: Uint8Array, sharedKey: ISharedKey): Uint8Array;

  /**
   * 生成随机 sessionKey（32 bytes）——多用户协作扩展用 (§5.7.5)。
   * 所有参与者持有此对称密钥；rekey 时换新 sessionKey 重新分发。
   */
  generateSessionKey(): Uint8Array;

  /**
   * 生成密码学随机 nonce 24 bytes。
   * NaCl 的 nonce 必须唯一；24 bytes 随机已足以避免碰撞。
   */
  randomNonce(): Uint8Array;

  /**
   * 生成密码学随机字节——sessionId / inviteId / capability nonce 用。
   */
  randomBytes(length: number): Uint8Array;
}

export const ISharedTerminalCryptoService = createIdentifier<ISharedTerminalCryptoService>(
  'shared-terminal.crypto-service'
);
