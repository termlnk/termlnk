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

import { Buffer } from 'node:buffer';
import { MASTER_KEY_DERIVATION } from '@termlnk/auth';
import { describe, expect, it } from 'vitest';
import { computeArgon2Salt, deriveMasterKey, deriveSubKeys, zeroize } from '../crypto/kdf';

const TEST_PASSWORD = 'correct horse battery staple';
const TEST_EMAIL = 'alice@example.com';
const TEST_SALT_B64 = Buffer.from('static-test-salt-32-bytes-fixed!').toString('base64');

describe('computeArgon2Salt', () => {
  it('appends server salt bytes after lowercased email bytes', () => {
    const salt = computeArgon2Salt(TEST_EMAIL, TEST_SALT_B64);
    const serverBytes = Buffer.from(TEST_SALT_B64, 'base64');
    const emailBytes = new TextEncoder().encode(TEST_EMAIL);

    expect(salt.length).toBe(emailBytes.length + serverBytes.length);
    expect(salt.subarray(0, emailBytes.length)).toEqual(emailBytes);
    expect(salt.subarray(emailBytes.length)).toEqual(new Uint8Array(serverBytes));
  });

  it('normalizes email casing and whitespace', () => {
    const a = computeArgon2Salt('  Alice@Example.com  ', TEST_SALT_B64);
    const b = computeArgon2Salt(TEST_EMAIL, TEST_SALT_B64);
    expect(a).toEqual(b);
  });

  it('produces different salts for different emails (cross-account isolation)', () => {
    const a = computeArgon2Salt('alice@example.com', TEST_SALT_B64);
    const b = computeArgon2Salt('bob@example.com', TEST_SALT_B64);
    expect(a).not.toEqual(b);
  });

  it('throws when server salt material is empty', () => {
    expect(() => computeArgon2Salt(TEST_EMAIL, '')).toThrow(/empty/i);
  });
});

describe('deriveMasterKey', () => {
  const ARGON2_TEST_TIMEOUT_MS = 30_000;

  it('returns a 32-byte key matching MASTER_KEY_DERIVATION.outputBytes', async () => {
    const salt = computeArgon2Salt(TEST_EMAIL, TEST_SALT_B64);
    const key = await deriveMasterKey(TEST_PASSWORD, salt);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(MASTER_KEY_DERIVATION.outputBytes);
  }, ARGON2_TEST_TIMEOUT_MS);

  it('is deterministic given identical password + salt', async () => {
    const salt = computeArgon2Salt(TEST_EMAIL, TEST_SALT_B64);
    const a = await deriveMasterKey(TEST_PASSWORD, salt);
    const b = await deriveMasterKey(TEST_PASSWORD, salt);
    expect(a).toEqual(b);
  }, ARGON2_TEST_TIMEOUT_MS);

  it('produces different keys when password changes', async () => {
    const salt = computeArgon2Salt(TEST_EMAIL, TEST_SALT_B64);
    const a = await deriveMasterKey(TEST_PASSWORD, salt);
    const b = await deriveMasterKey(`${TEST_PASSWORD}!`, salt);
    expect(a).not.toEqual(b);
  }, ARGON2_TEST_TIMEOUT_MS);

  it('produces different keys when salt changes', async () => {
    const saltA = computeArgon2Salt(TEST_EMAIL, TEST_SALT_B64);
    const otherB64 = Buffer.from('different-server-random-32bytesx').toString('base64');
    const saltB = computeArgon2Salt(TEST_EMAIL, otherB64);
    const a = await deriveMasterKey(TEST_PASSWORD, saltA);
    const b = await deriveMasterKey(TEST_PASSWORD, saltB);
    expect(a).not.toEqual(b);
  }, ARGON2_TEST_TIMEOUT_MS);
});

describe('deriveSubKeys', () => {
  // 用一把 deterministic 假 master key 替代真正的 Argon2 派生（测试只关心 HKDF 行为）
  const FAKE_MASTER_KEY = new Uint8Array(32).fill(0x42);

  it('returns three 32-byte sub keys', () => {
    const keys = deriveSubKeys(FAKE_MASTER_KEY);
    expect(keys.authKey.length).toBe(32);
    expect(keys.encKey.length).toBe(32);
    expect(keys.indexKey.length).toBe(32);
  });

  it('produces three pairwise-different sub keys (domain separation)', () => {
    const { authKey, encKey, indexKey } = deriveSubKeys(FAKE_MASTER_KEY);
    expect(authKey).not.toEqual(encKey);
    expect(authKey).not.toEqual(indexKey);
    expect(encKey).not.toEqual(indexKey);
  });

  it('is deterministic given identical master key', () => {
    const a = deriveSubKeys(FAKE_MASTER_KEY);
    const b = deriveSubKeys(FAKE_MASTER_KEY);
    expect(a.authKey).toEqual(b.authKey);
    expect(a.encKey).toEqual(b.encKey);
    expect(a.indexKey).toEqual(b.indexKey);
  });

  it('produces different sub keys when master key differs', () => {
    const other = new Uint8Array(32).fill(0x43);
    const a = deriveSubKeys(FAKE_MASTER_KEY);
    const b = deriveSubKeys(other);
    expect(a.authKey).not.toEqual(b.authKey);
    expect(a.encKey).not.toEqual(b.encKey);
    expect(a.indexKey).not.toEqual(b.indexKey);
  });
});

describe('zeroize', () => {
  it('fills the buffer with zero bytes in place', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    zeroize(buf);
    expect(buf).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
  });

  it('is a no-op on null / undefined', () => {
    expect(() => zeroize(null)).not.toThrow();
    expect(() => zeroize(undefined)).not.toThrow();
  });
});
