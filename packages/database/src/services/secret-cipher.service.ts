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
 * 加密格式标记前缀。Repository 用它判断字段是否已加密，迁移脚本用它做幂等检查。
 *
 * 真实密文形如 `tmenc1:{base64-json-payload}`，其中 payload 是
 * `{ scheme, iv?, ciphertext, tag? }` 的 JSON。
 */
export const SECRET_CIPHER_PREFIX = 'tmenc1:';

export type SecretCipherScheme =
  | 'safe-storage' // Electron safeStorage（OS keystore：macOS Keychain / Windows DPAPI / Linux libsecret）
  | 'local-derived'; // 跨平台兜底：Node crypto + 设备指纹派生 master key

/**
 * 加密原语契约。
 *
 * 设计要点：
 * - 同步 API：safeStorage 是同步的；Node crypto 也是同步的；避免 async 蔓延
 * - 字符串入字符串出：Repository 调用方不必关心字节编码
 * - 输出永远以 `SECRET_CIPHER_PREFIX` 起头，便于幂等判断
 */
export interface ISecretCipherService {
  readonly scheme: SecretCipherScheme;

  /** 是否当前进程可用（如 safeStorage 在某些 Linux 环境不可用时返回 false） */
  isAvailable(): boolean;

  /**
   * 加密明文。
   * @param plaintext UTF-8 字符串。空字符串原样返回（不加密空值）。
   * @returns 以 `SECRET_CIPHER_PREFIX` 开头的密文字符串
   */
  encrypt(plaintext: string): string;

  /**
   * 解密密文。
   * @param ciphertext 以 `SECRET_CIPHER_PREFIX` 开头的密文。若不带前缀则按原样返回（兼容旧明文）
   * @returns 原始明文
   */
  decrypt(ciphertext: string): string;
}

export const ISecretCipherService = createIdentifier<ISecretCipherService>(
  'database.secret-cipher.service'
);

/** 便捷判断：字符串是否是已加密格式 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(SECRET_CIPHER_PREFIX);
}
