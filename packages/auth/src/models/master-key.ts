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
 * Master Key 状态机。
 * - Locked：未登录，或登录后被显式 lock，或会话过期清除——内存中无密钥
 * - Unlocked：已登录，主密钥在主进程内存中可用
 */
export enum MasterKeyState {
  Locked = 'locked',
  Unlocked = 'unlocked',
}

/**
 * Master Key — 由用户主密码 + 邮箱 salt 经 Argon2id 派生，再 HKDF 拆为三把子密钥。
 *
 * **生命周期**：仅在主进程内存中存在（不持久化、不跨 IPC、进程退出即销毁）。
 * **零知识**：派生过程纯客户端，主密码 + master key 永不离开主进程。
 *
 * 三把子密钥用途：
 * - `authKey`：服务端 SRP6a verifier 派生 / JWT 鉴权 hash 输入；服务端验证用，攻击者拿到也无法反推 encKey
 * - `encKey`：资源加密密钥（XChaCha20-Poly1305 key），用于同步 payload / 备份导出加密
 * - `indexKey`：HMAC 索引密钥，生成可索引但不可逆的字段 ID hash（用于云端按 hash 查找而不暴露明文）
 */
export interface IMasterKey {
  /** 服务端鉴权用（SRP6a verifier / JWT auth hash） */
  readonly authKey: Uint8Array;
  /** 资源加密用 */
  readonly encKey: Uint8Array;
  /** 索引 HMAC 用 */
  readonly indexKey: Uint8Array;
  /** 用户邮箱（master key 派生 salt 的固定部分）；用于多账号场景识别 */
  readonly email: string;
}

/**
 * Argon2id 派生材料——用户的 salt（邮箱 + 服务端发的随机部分）。
 * salt 在注册时由客户端生成上传到服务端，登录时服务端返回让客户端重新派生。
 */
export interface IDerivationMaterial {
  /** 邮箱（既是用户标识，也是 salt 的固定部分） */
  email: string;
  /** 服务端持久化的随机 salt（base64） */
  saltB64: string;
}
