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

// Main-process cipher backed by Electron safeStorage (Keychain / DPAPI / libsecret).
// Falls back to LocalDerivedSecretCipher when the OS keystore is unavailable
// (e.g. headless Linux without gnome-keyring/kwallet). The fallback is also used
// to decrypt rows that were written under the local-derived scheme, so users can
// move between environments without losing access to existing data.
export class SafeStorageCipher implements ISecretCipherService {
  readonly scheme: SecretCipherScheme;

  private readonly _fallback = new LocalDerivedSecretCipher();

  constructor(@ILogService private readonly _logService: ILogService) {
    this.scheme = safeStorage.isEncryptionAvailable() ? 'safe-storage' : 'local-derived';

    if (this.scheme === 'local-derived') {
      this._logService.warn(
        '[SafeStorageCipher] OS keystore unavailable; falling back to LocalDerivedSecretCipher. '
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

    // Route by the payload's own scheme so cross-scheme migration works.
    if (payload.scheme === 'local-derived') {
      return this._fallback.decrypt(ciphertext);
    }

    if (payload.scheme === 'safe-storage') {
      if (this.scheme === 'local-derived') {
        // User somehow lost keystore access between sessions; refuse rather than crash.
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
