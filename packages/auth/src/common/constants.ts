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

export const AUTH_PLUGIN_NAME = 'AUTH_PLUGIN';
export const AUTH_PLUGIN_CONFIG_KEY = 'auth.config';

/**
 * Argon2id 密钥派生参数（client-side master key derivation）。
 *
 * 参数选择依据：OWASP 2023 Argon2id 推荐 m=64MiB / t=3 / p=4 用于 password hashing；
 * Standard Notes 005 用 64MiB / t=5。我们采用 OWASP 基线 + 1MiB 余量。
 *
 * 注意：iterations 在不同库中可能称作 timeCost / opsLimit。
 */
export const MASTER_KEY_DERIVATION = {
  /** Argon2id memory cost (KiB) */
  memoryKiB: 65_536,
  /** Argon2id iterations (time cost) */
  iterations: 3,
  /** Argon2id parallelism */
  parallelism: 4,
  /** 派生密钥长度（bytes）；后续 HKDF 拆为 auth/enc/index 三把子密钥 */
  outputBytes: 32,
} as const;

/**
 * HKDF info 标签：Master Key 派生出三把子密钥的 domain separation。
 * 参考 Bitwarden 的 stretched master key + 角色密钥模式。
 */
export const HKDF_INFO = {
  /** 服务端鉴权 hash（SRP6a verifier 派生材料 / JWT 鉴权用） */
  AUTH: 'termlnk.auth.v1',
  /** 资源加密密钥（XChaCha20-Poly1305 key） */
  ENC: 'termlnk.enc.v1',
  /** HMAC 索引密钥（生成可索引但不可逆的 ID hash） */
  INDEX: 'termlnk.index.v1',
} as const;
