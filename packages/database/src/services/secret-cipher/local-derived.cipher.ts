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

// Cross-platform fallback cipher. Master key is derived from a device fingerprint
// (hostname + username), so an SQLite copy moved to another machine cannot be decrypted.
// This is strictly a hardening step over plaintext storage, not a substitute for
// an OS-managed keystore.
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
    // Legacy plaintext (no prefix) passes through; lets readers cope with un-migrated rows.
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
    // Salt is fixed because the input is already a device fingerprint, not a user password;
    // PBKDF2 here is used purely to expand the fingerprint into a uniform 256-bit key.
    return pbkdf2Sync(fingerprint, 'termlnk-secret-cipher-v1', 100_000, 32, 'sha256');
  }
}
