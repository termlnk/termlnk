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
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SECRET_CIPHER_PREFIX } from '../secret-cipher.service';
import { decodeSecretPayload, encodeSecretPayload } from './secret-payload';

// Shared AES-256-GCM implementation; concrete schemes differ only in where the key comes from.
export class AesGcmSecretCipher implements ISecretCipherService {
  constructor(
    readonly scheme: SecretCipherScheme,
    private readonly _key: Buffer
  ) {}

  encrypt(plaintext: string): string {
    if (plaintext === '') {
      return '';
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this._key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return encodeSecretPayload({
      scheme: this.scheme,
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    });
  }

  decrypt(ciphertext: string): string {
    // Legacy plaintext (no prefix) passes through; lets readers cope with un-migrated rows.
    if (!ciphertext.startsWith(SECRET_CIPHER_PREFIX)) {
      return ciphertext;
    }

    const payload = decodeSecretPayload(ciphertext);

    if (payload.scheme !== this.scheme) {
      throw new Error(
        `[AesGcmSecretCipher] Cannot decrypt scheme '${payload.scheme}' with scheme '${this.scheme}'`
      );
    }

    if (!payload.iv || !payload.tag) {
      throw new Error('[AesGcmSecretCipher] Malformed payload: missing iv or tag');
    }

    const decipher = createDecipheriv('aes-256-gcm', this._key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]);

    return decrypted.toString('utf8');
  }
}
