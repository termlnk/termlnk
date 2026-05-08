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

import type { ISecretCipherService, SecretCipherScheme } from '../secret-cipher.service';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { SECRET_CIPHER_PREFIX } from '../secret-cipher.service';

/**
 * 跨平台兜底加密器。
 *
 * 设计取舍（明示）：
 * - **不依赖 OS keystore**：纯 Node crypto + 设备指纹派生 master key，CI/容器/Linux 无 secret-service 都能跑
 * - **设备绑定**：master key 派生输入 = `hostname || username || fixed-salt`，搬到另一台机器就解不开
 * - **威胁模型边界**：拷走 SQLite 文件 + 同机器 = 仍可解密（master key 来自相同设备指纹）；这是相对 plaintext 的进步，**不是替代 OS keystore 的强加密**
 * - **算法**：PBKDF2-SHA256(100k 轮) → AES-256-GCM；都是 Node 原生支持
 *
 * 何时使用：
 * - apps/desktop/main 检测 `safeStorage.isEncryptionAvailable()` 失败时降级
 * - 单元测试 / CI（无 Electron 上下文）
 * - 未来支持的 headless server 模式
 */
export class LocalDerivedSecretCipher implements ISecretCipherService {
  readonly scheme: SecretCipherScheme = 'local-derived';

  private readonly _key: Buffer;

  constructor(masterKey?: Buffer) {
    this._key = masterKey ?? this._deriveKeyFromDevice();
  }

  isAvailable(): boolean {
    return true;
  }

  encrypt(plaintext: string): string {
    if (plaintext === '') {
      return '';
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this._key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = {
      scheme: this.scheme,
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };

    return SECRET_CIPHER_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  }

  decrypt(ciphertext: string): string {
    // 兼容：未加密的旧明文原样返回（迁移期能继续读旧数据）
    if (!ciphertext.startsWith(SECRET_CIPHER_PREFIX)) {
      return ciphertext;
    }

    const body = ciphertext.slice(SECRET_CIPHER_PREFIX.length);
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as {
      scheme: SecretCipherScheme;
      iv?: string;
      ciphertext: string;
      tag?: string;
    };

    if (payload.scheme !== this.scheme) {
      throw new Error(
        `[LocalDerivedSecretCipher] Cannot decrypt scheme '${payload.scheme}' with this cipher`
      );
    }

    if (!payload.iv || !payload.tag) {
      throw new Error('[LocalDerivedSecretCipher] Malformed payload: missing iv or tag');
    }

    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const encrypted = Buffer.from(payload.ciphertext, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', this._key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  }

  private _deriveKeyFromDevice(): Buffer {
    const fingerprint = `${hostname()}|${userInfo().username}|termlnk-local-derived-v1`;
    // PBKDF2-SHA256, 100k iterations, 256-bit output
    // salt 用固定值是因为输入本身已经是设备指纹（不是用户密码），这里 KDF 主要用于均匀化分布到 256-bit 密钥空间
    return pbkdf2Sync(fingerprint, 'termlnk-secret-cipher-v1', 100_000, 32, 'sha256');
  }
}
