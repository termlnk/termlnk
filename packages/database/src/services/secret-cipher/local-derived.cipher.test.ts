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
import { isEncrypted, SECRET_CIPHER_PREFIX } from '../secret-cipher.service';
import { LocalDerivedSecretCipher } from './local-derived.cipher';

describe('localDerivedSecretCipher', () => {
  it('encrypts and decrypts a UTF-8 string round-trip', () => {
    const cipher = new LocalDerivedSecretCipher();
    const plaintext = 'super-secret-password-🔐';

    const encrypted = cipher.encrypt(plaintext);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted).toMatch(new RegExp(`^${SECRET_CIPHER_PREFIX}`));
    expect(encrypted).not.toContain(plaintext);

    const decrypted = cipher.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('returns empty string for empty input', () => {
    const cipher = new LocalDerivedSecretCipher();
    expect(cipher.encrypt('')).toBe('');
    expect(cipher.decrypt('')).toBe('');
  });

  it('returns plaintext as-is when decrypting unencrypted value (backwards compat)', () => {
    const cipher = new LocalDerivedSecretCipher();
    expect(cipher.decrypt('plain-text-old-value')).toBe('plain-text-old-value');
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const cipher = new LocalDerivedSecretCipher();
    const plaintext = 'same-input';
    const a = cipher.encrypt(plaintext);
    const b = cipher.encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(cipher.decrypt(a)).toBe(plaintext);
    expect(cipher.decrypt(b)).toBe(plaintext);
  });

  it('decrypt fails with wrong master key (auth tag mismatch)', () => {
    const cipherA = new LocalDerivedSecretCipher(randomBytes(32));
    const cipherB = new LocalDerivedSecretCipher(randomBytes(32));
    const encrypted = cipherA.encrypt('secret');
    expect(() => cipherB.decrypt(encrypted)).toThrow();
  });

  it('reports scheme correctly', () => {
    const cipher = new LocalDerivedSecretCipher();
    expect(cipher.scheme).toBe('local-derived');
    expect(cipher.isAvailable()).toBe(true);
  });

  it('handles long strings (e.g. RSA private keys)', () => {
    const cipher = new LocalDerivedSecretCipher();
    const longKey = `-----BEGIN RSA PRIVATE KEY-----\n${'a'.repeat(4096)}\n-----END RSA PRIVATE KEY-----`;
    const encrypted = cipher.encrypt(longKey);
    expect(cipher.decrypt(encrypted)).toBe(longKey);
  });
});
