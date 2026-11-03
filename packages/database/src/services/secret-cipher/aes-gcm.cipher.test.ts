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

import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isEncrypted } from '../secret-cipher.service';
import { AesGcmSecretCipher } from './aes-gcm.cipher';
import { decodeSecretPayload, encodeSecretPayload, isLegacySafeStorageValue, tryDecodeSecretPayload } from './secret-payload';

describe('aesGcmSecretCipher', () => {
  it('round-trips under the configured scheme', () => {
    const cipher = new AesGcmSecretCipher('safe-storage-envelope', randomBytes(32));
    const encrypted = cipher.encrypt('hunter2-🔐');

    expect(isEncrypted(encrypted)).toBe(true);
    expect(decodeSecretPayload(encrypted).scheme).toBe('safe-storage-envelope');
    expect(cipher.decrypt(encrypted)).toBe('hunter2-🔐');
  });

  it('refuses payloads of another scheme even with the same key', () => {
    const key = randomBytes(32);
    const envelope = new AesGcmSecretCipher('safe-storage-envelope', key);
    const local = new AesGcmSecretCipher('local-derived', key);

    expect(() => local.decrypt(envelope.encrypt('secret'))).toThrow(/Cannot decrypt scheme/);
  });

  it('fails authentication with a different key', () => {
    const a = new AesGcmSecretCipher('safe-storage-envelope', randomBytes(32));
    const b = new AesGcmSecretCipher('safe-storage-envelope', randomBytes(32));

    expect(() => b.decrypt(a.encrypt('secret'))).toThrow();
  });
});

describe('secretPayload', () => {
  it('detects legacy safe-storage values and tolerates garbage', () => {
    const legacy = encodeSecretPayload({ scheme: 'safe-storage', ciphertext: 'AAAA' });
    const envelope = encodeSecretPayload({ scheme: 'safe-storage-envelope', ciphertext: 'AAAA' });

    expect(isLegacySafeStorageValue(legacy)).toBe(true);
    expect(isLegacySafeStorageValue(envelope)).toBe(false);
    expect(isLegacySafeStorageValue('plain')).toBe(false);
    expect(tryDecodeSecretPayload('tmenc1:!!!not-base64-json')).toBeNull();
  });
});
