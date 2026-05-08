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

import type { ISecretCipherService, SecretCipherScheme } from '@termlnk/database';
import { ILogService } from '@termlnk/core';
import { isEncrypted, LocalDerivedSecretCipher, SECRET_CIPHER_PREFIX } from '@termlnk/database';
import { safeStorage } from 'electron';

/**
 * 主进程加密器：基于 Electron `safeStorage` 调用 OS keystore（macOS Keychain / Windows DPAPI / Linux libsecret）。
 *
 * 设计要点：
 * - **优先使用 OS keystore**：被攻陷时需要操作系统级访问才能解密
 * - **Linux 兜底**：当 `safeStorage.isEncryptionAvailable()` 为 false（如未装 gnome-keyring/kwallet 的最小化 Linux），自动降级到 `LocalDerivedSecretCipher`
 * - **可读旧 scheme**：解密时会根据 payload 中的 `scheme` 字段决定走 safeStorage 还是 local-derived，平滑迁移
 * - **威胁模型**：safeStorage 的密钥由 OS 管理，应用自身仅持调用句柄；拷走 SQLite 文件 + 没有 OS 访问 = 解不开
 */
export class SafeStorageCipher implements ISecretCipherService {
  readonly scheme: SecretCipherScheme;

  /** Local-derived 兜底实例。永远存在：write 路径在 keystore 不可用时使用，read 路径用于解 local-derived scheme 旧密文。 */
  private readonly _fallback = new LocalDerivedSecretCipher();

  constructor(@ILogService private readonly _logService: ILogService) {
    this.scheme = safeStorage.isEncryptionAvailable() ? 'safe-storage' : 'local-derived';

    if (this.scheme === 'local-derived') {
      this._logService.warn(
        '[SafeStorageCipher] OS keystore unavailable on this system; falling back to LocalDerivedSecretCipher. '
        + 'Install gnome-keyring (GNOME) or kwallet (KDE) on Linux for stronger protection.'
      );
    }
  }

  isAvailable(): boolean {
    return true;
  }

  encrypt(plaintext: string): string {
    if (plaintext === '') {
      return '';
    }
    if (this.scheme === 'local-derived') {
      return this._fallback.encrypt(plaintext);
    }

    const buffer = safeStorage.encryptString(plaintext);
    const payload = {
      scheme: 'safe-storage' as SecretCipherScheme,
      ciphertext: buffer.toString('base64'),
    };
    return SECRET_CIPHER_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  }

  decrypt(ciphertext: string): string {
    if (!isEncrypted(ciphertext)) {
      return ciphertext;
    }

    const body = ciphertext.slice(SECRET_CIPHER_PREFIX.length);
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as {
      scheme: SecretCipherScheme;
      ciphertext: string;
      [k: string]: unknown;
    };

    // 按 payload 自带 scheme 路由，支持跨 scheme 平滑迁移
    if (payload.scheme === 'local-derived') {
      return this._fallback.decrypt(ciphertext);
    }

    if (payload.scheme === 'safe-storage') {
      if (this.scheme === 'local-derived') {
        // 用户从有 keystore 的环境切到无 keystore 环境（理论不应发生）；返回空避免崩溃
        this._logService.error(
          '[SafeStorageCipher] Cannot decrypt safe-storage ciphertext: OS keystore unavailable in current session'
        );
        return '';
      }
      return safeStorage.decryptString(Buffer.from(payload.ciphertext, 'base64'));
    }

    throw new Error(`[SafeStorageCipher] Unknown scheme '${payload.scheme}'`);
  }
}
