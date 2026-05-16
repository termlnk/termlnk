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
  decryptMcpConfig,
  decryptProxy,
  encryptCredential,
  encryptIfNeeded,
  encryptMcpConfig,
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
      expect(encrypted.username).toBe('root'); // username stays plaintext
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
      expect((twice as any).password).toBe((once as any).password);
      expect(decryptCredential(twice, cipher)).toEqual(original);
    });

    it('handles legacy plaintext on read path (graceful migration)', () => {
      const legacy = { type: 'password' as const, username: 'root', password: 'plain-old-pwd' };
      const decrypted = decryptCredential(legacy, cipher)!;
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

  describe('encryptMcpConfig / decryptMcpConfig', () => {
    it('encrypts stdio env values keeping keys plain', () => {
      const config = {
        type: 'stdio' as const,
        command: 'node',
        args: ['mcp.js'],
        env: { DEBUG: 'true', API_KEY: 'sk-secret' },
      };
      const encrypted = encryptMcpConfig(config, cipher)!;
      expect(encrypted.type).toBe('stdio');
      if (encrypted.type !== 'stdio') {
        throw new Error('expected stdio');
      }
      expect(encrypted.command).toBe('node');
      expect(encrypted.args).toEqual(['mcp.js']);
      expect(Object.keys(encrypted.env!)).toEqual(['DEBUG', 'API_KEY']);
      expect(isEncrypted(encrypted.env!.DEBUG)).toBe(true);
      expect(isEncrypted(encrypted.env!.API_KEY)).toBe(true);
      expect(encrypted.env!.API_KEY).not.toContain('sk-secret');

      expect(decryptMcpConfig(encrypted, cipher)).toEqual(config);
    });

    it('encrypts http headers values', () => {
      const config = {
        type: 'http' as const,
        url: 'https://example.com',
        protocol: 'streamable-http' as const,
        headers: { Authorization: 'Bearer xxx', 'X-Custom': 'plain-meta' },
      };
      const encrypted = encryptMcpConfig(config, cipher)!;
      if (encrypted.type !== 'http') {
        throw new Error('expected http');
      }
      expect(encrypted.url).toBe('https://example.com');
      expect(isEncrypted(encrypted.headers!.Authorization)).toBe(true);
      expect(isEncrypted(encrypted.headers!['X-Custom'])).toBe(true);

      expect(decryptMcpConfig(encrypted, cipher)).toEqual(config);
    });

    it('returns config unchanged when env / headers absent', () => {
      const stdioNoEnv = { type: 'stdio' as const, command: 'node' };
      expect(encryptMcpConfig(stdioNoEnv, cipher)).toEqual(stdioNoEnv);

      const httpNoHeaders = { type: 'http' as const, url: 'x', protocol: 'sse' as const };
      expect(encryptMcpConfig(httpNoHeaders, cipher)).toEqual(httpNoHeaders);
    });

    it('handles null', () => {
      expect(encryptMcpConfig(null, cipher)).toBeNull();
      expect(decryptMcpConfig(null, cipher)).toBeNull();
    });

    it('idempotent on re-encryption', () => {
      const config = {
        type: 'stdio' as const,
        command: 'node',
        env: { TOKEN: 'abc123' },
      };
      const once = encryptMcpConfig(config, cipher)!;
      const twice = encryptMcpConfig(once, cipher)!;
      if (once.type !== 'stdio' || twice.type !== 'stdio') {
        throw new Error('type narrowing failed');
      }
      expect(twice.env!.TOKEN).toBe(once.env!.TOKEN);
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

    it('returns null for null/undefined input', () => {
      expect(encryptIfNeeded(null, cipher)).toBeNull();
      expect(encryptIfNeeded(undefined, cipher)).toBeNull();
      expect(decryptIfNeeded(null, cipher)).toBeNull();
      expect(decryptIfNeeded(undefined, cipher)).toBeNull();
    });

    it('idempotent: does not re-encrypt already encrypted', () => {
      const once = encryptIfNeeded('value', cipher);
      const twice = encryptIfNeeded(once, cipher);
      expect(twice).toBe(once);
    });
  });
});
