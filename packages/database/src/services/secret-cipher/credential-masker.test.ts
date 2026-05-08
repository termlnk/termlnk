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

import { describe, expect, it } from 'vitest';
import { isEncrypted } from '../secret-cipher.service';
import {
  decryptCredential,
  decryptIfNeeded,
  decryptProxy,
  encryptCredential,
  encryptIfNeeded,
  encryptProxy,
} from './credential-masker';
import { LocalDerivedSecretCipher } from './local-derived.cipher';

describe('credentialMasker', () => {
  const cipher = new LocalDerivedSecretCipher();

  describe('encryptCredential / decryptCredential', () => {
    it('returns null for null/undefined input', () => {
      expect(encryptCredential(null, cipher)).toBeNull();
      expect(encryptCredential(undefined, cipher)).toBeNull();
      expect(decryptCredential(null, cipher)).toBeNull();
    });

    it('encrypts password credential keeping username plain', () => {
      const original = { type: 'password' as const, username: 'root', password: 'hunter2' };
      const encrypted = encryptCredential(original, cipher)!;
      expect(encrypted.type).toBe('password');
      expect(encrypted.username).toBe('root'); // 明文保留
      expect((encrypted as any).password).not.toBe('hunter2');
      expect(isEncrypted((encrypted as any).password)).toBe(true);

      const decrypted = decryptCredential(encrypted, cipher)!;
      expect(decrypted).toEqual(original);
    });

    it('encrypts rsa credential keeping username plain', () => {
      const original = {
        type: 'rsa' as const,
        username: 'admin',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMII...\n-----END RSA PRIVATE KEY-----',
      };
      const encrypted = encryptCredential(original, cipher)!;
      expect(encrypted.type).toBe('rsa');
      expect(encrypted.username).toBe('admin');
      expect((encrypted as any).privateKey).not.toBe(original.privateKey);
      expect(isEncrypted((encrypted as any).privateKey)).toBe(true);

      const decrypted = decryptCredential(encrypted, cipher)!;
      expect(decrypted).toEqual(original);
    });

    it('returns "always" credential as-is (no sensitive fields)', () => {
      const original = { type: 'always' as const, username: 'agent' };
      expect(encryptCredential(original, cipher)).toEqual(original);
      expect(decryptCredential(original, cipher)).toEqual(original);
    });

    it('is idempotent: encrypting an already-encrypted credential does not double-encrypt', () => {
      const original = { type: 'password' as const, username: 'root', password: 'hunter2' };
      const once = encryptCredential(original, cipher)!;
      const twice = encryptCredential(once, cipher)!;
      // 两次加密的密文应当相同（idempotent）
      expect((twice as any).password).toBe((once as any).password);
      // 解密结果应当还是原值
      expect(decryptCredential(twice, cipher)).toEqual(original);
    });

    it('handles legacy plaintext on read path (graceful migration)', () => {
      // 旧明文：从未被加密过的数据
      const legacy = { type: 'password' as const, username: 'root', password: 'plain-old-pwd' };
      const decrypted = decryptCredential(legacy, cipher)!;
      // 解密层对未加密值原样返回
      expect((decrypted as any).password).toBe('plain-old-pwd');
    });
  });

  describe('encryptProxy / decryptProxy', () => {
    it('encrypts proxy password only', () => {
      const proxy = {
        enabled: true,
        type: 'socks5' as const,
        host: '127.0.0.1',
        port: 1080,
        username: 'u',
        password: 'p',
      };
      const encrypted = encryptProxy(proxy, cipher)!;
      expect(encrypted.host).toBe('127.0.0.1');
      expect(encrypted.username).toBe('u');
      expect(encrypted.password).not.toBe('p');
      expect(isEncrypted(encrypted.password!)).toBe(true);

      expect(decryptProxy(encrypted, cipher)).toEqual(proxy);
    });

    it('returns proxy unchanged when no password', () => {
      const proxy = { enabled: true, type: 'http' as const, host: 'x', port: 80 };
      expect(encryptProxy(proxy, cipher)).toEqual(proxy);
      expect(decryptProxy(proxy, cipher)).toEqual(proxy);
    });
  });

  describe('encryptIfNeeded / decryptIfNeeded', () => {
    it('encrypts non-empty string', () => {
      const out = encryptIfNeeded('sk-xxx', cipher);
      expect(isEncrypted(out)).toBe(true);
      expect(decryptIfNeeded(out, cipher)).toBe('sk-xxx');
    });

    it('returns empty string as-is', () => {
      expect(encryptIfNeeded('', cipher)).toBe('');
      expect(decryptIfNeeded('', cipher)).toBe('');
    });

    it('returns null/undefined as empty string', () => {
      expect(encryptIfNeeded(null, cipher)).toBe('');
      expect(encryptIfNeeded(undefined, cipher)).toBe('');
    });

    it('idempotent: does not re-encrypt already encrypted', () => {
      const once = encryptIfNeeded('value', cipher);
      const twice = encryptIfNeeded(once, cipher);
      expect(twice).toBe(once);
    });
  });
});
