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

// eslint-disable-next-line penetrating/no-penetrating-import -- @noble/ciphers 2.x exports only `.js` subpaths
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { createIdentifier } from '@termlnk/core';
import { deleteItemAsync, getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';

// Device-bound encryption service for the mobile host repository. The 32-byte DEK lives
// in iOS Keychain / Android Keystore via expo-secure-store (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
// and never crosses the network. The frame format is `tmlocal1:` + 24-byte XChaCha20
// nonce + Poly1305-tagged ciphertext — distinct prefix from the sync layer's `tmsync1:`
// to prevent a misrouted blob from being silently decrypted with the wrong key.
//
// Symmetry with the desktop SecretCipher service: both bind secrets to the device,
// neither participates in cloud sync. The cloud round-trip is handled by SyncCryptoService
// using the user's master key; this service only encrypts what lives on disk locally.
//
// Biometric hook: expo-secure-store's `requireAuthentication: true` would gate every
// DEK read on Touch ID / Face ID. v1 leaves it disabled per the plan; flipping to true
// is a one-line change.

const DEK_KEY = 'termlnk.mobile.host-dek-v1';
const FRAME_PREFIX = 'tmlocal1:';
const PREFIX_BYTES = new TextEncoder().encode(FRAME_PREFIX);
const NONCE_LEN = 24;
const POLY1305_TAG_LEN = 16;
const DEK_LEN = 32;

export interface IMobileSecretCipherService {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}

export const IMobileSecretCipherService = createIdentifier<IMobileSecretCipherService>('mobile.secret-cipher.service');

export class MobileSecretCipherService implements IMobileSecretCipherService {
  // In-memory DEK cache. Lifetime = process lifetime, since the DEK is unconditionally
  // device-bound (no master-key gating). React Native garbage-collects on app kill;
  // backgrounded apps keep the cache hot for instant resume.
  private _dek: Uint8Array | null = null;
  private _dekPromise: Promise<Uint8Array> | null = null;

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    const dek = await this._loadOrCreateDek();
    const nonce = new Uint8Array(NONCE_LEN);
    crypto.getRandomValues(nonce);
    const sealed = xchacha20poly1305(dek, nonce).encrypt(plaintext);
    const frame = new Uint8Array(PREFIX_BYTES.length + NONCE_LEN + sealed.length);
    frame.set(PREFIX_BYTES, 0);
    frame.set(nonce, PREFIX_BYTES.length);
    frame.set(sealed, PREFIX_BYTES.length + NONCE_LEN);
    return frame;
  }

  async decrypt(frame: Uint8Array): Promise<Uint8Array> {
    if (frame.length < PREFIX_BYTES.length + NONCE_LEN + POLY1305_TAG_LEN) {
      throw new Error('[MobileSecretCipher] cipher frame too short');
    }
    for (let i = 0; i < PREFIX_BYTES.length; i++) {
      if (frame[i] !== PREFIX_BYTES[i]) {
        throw new Error('[MobileSecretCipher] cipher frame missing tmlocal1 prefix');
      }
    }
    const nonce = frame.slice(PREFIX_BYTES.length, PREFIX_BYTES.length + NONCE_LEN);
    const sealed = frame.slice(PREFIX_BYTES.length + NONCE_LEN);

    const dek = await this._loadOrCreateDek();
    return xchacha20poly1305(dek, nonce).decrypt(sealed);
  }

  // Concurrent callers during cold start share a single secure-store read so we never
  // race two `setItemAsync` calls (which would generate two competing DEKs and lock
  // the user out of previously encrypted rows).
  private _loadOrCreateDek(): Promise<Uint8Array> {
    if (this._dek) {
      return Promise.resolve(this._dek);
    }
    if (!this._dekPromise) {
      this._dekPromise = (async () => {
        const existing = await getItemAsync(DEK_KEY, {
          keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        if (existing) {
          const bytes = base64ToBytes(existing);
          if (bytes.length !== DEK_LEN) {
            // Corrupt entry — overwrite. Previously encrypted rows are unrecoverable
            // at this point; the host repository handles decrypt failures by surfacing
            // them as missing credentials, which falls back to the manual-input path.
            await deleteItemAsync(DEK_KEY, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
            return this._generateAndStoreDek();
          }
          this._dek = bytes;
          return bytes;
        }
        return this._generateAndStoreDek();
      })().finally(() => {
        this._dekPromise = null;
      });
    }
    return this._dekPromise;
  }

  private async _generateAndStoreDek(): Promise<Uint8Array> {
    const bytes = new Uint8Array(DEK_LEN);
    crypto.getRandomValues(bytes);
    await setItemAsync(DEK_KEY, bytesToBase64(bytes), {
      keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      // requireAuthentication: false  // v1 leaves this off; v1.1 flips to true for biometric gating.
    });
    this._dek = bytes;
    return bytes;
  }
}
