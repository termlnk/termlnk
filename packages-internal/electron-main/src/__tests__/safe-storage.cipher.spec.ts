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

import type { ILogService, LogLevel } from '@termlnk/core';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeSecretPayload, LocalDerivedSecretCipher } from '@termlnk/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake keystore: "wrapping" prefixes the plaintext so tests can tell versions apart.
const keystore = vi.hoisted(() => ({
  available: true,
  failDecrypt: false,
  shouldReEncrypt: false,
  version: 'v1',
}));

vi.mock('electron', () => ({
  safeStorage: {
    isAsyncEncryptionAvailable: async () => keystore.available,
    encryptStringAsync: async (plain: string) => Buffer.from(`${keystore.version}:${plain}`),
    decryptStringAsync: async (buffer: Buffer) => {
      if (keystore.failDecrypt) {
        throw new Error('keystore locked');
      }
      const text = buffer.toString();
      return { result: text.slice(text.indexOf(':') + 1), shouldReEncrypt: keystore.shouldReEncrypt };
    },
  },
}));

const { createSafeStorageCipher } = await import('../services/secret-cipher/safe-storage.cipher');

class RecordingLogService implements ILogService {
  readonly errors: unknown[][] = [];
  readonly warnings: unknown[][] = [];
  debug(): void {}
  log(): void {}
  warn(...args: unknown[]): void { this.warnings.push(args); }
  error(...args: unknown[]): void { this.errors.push(args); }
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

describe('createSafeStorageCipher', () => {
  let dir: string;
  let keyFilePath: string;
  let logService: RecordingLogService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'termlnk-cipher-'));
    keyFilePath = join(dir, 'secret-key');
    logService = new RecordingLogService();
    Object.assign(keystore, { available: true, failDecrypt: false, shouldReEncrypt: false, version: 'v1' });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips under the envelope scheme', async () => {
    const cipher = await createSafeStorageCipher({ keyFilePath, logService });

    const encrypted = cipher.encrypt('hunter2-🔐');

    expect(cipher.scheme).toBe('safe-storage-envelope');
    expect(encrypted).not.toContain('hunter2');
    expect(cipher.decrypt(encrypted)).toBe('hunter2-🔐');
    expect(cipher.encrypt('')).toBe('');
    expect(cipher.decrypt('plain')).toBe('plain');
  });

  it('decrypts local-derived payloads written earlier', async () => {
    const cipher = await createSafeStorageCipher({ keyFilePath, logService });
    const local = new LocalDerivedSecretCipher().encrypt('from-local');

    expect(cipher.decrypt(local)).toBe('from-local');
  });

  it('creates the wrapped key file with mode 0600 and reuses it across instances', async () => {
    const first = await createSafeStorageCipher({ keyFilePath, logService });
    const encrypted = first.encrypt('shared');

    expect((await stat(keyFilePath)).mode & 0o777).toBe(0o600);
    const fileBefore = await readFile(keyFilePath);

    const second = await createSafeStorageCipher({ keyFilePath, logService });

    expect(second.decrypt(encrypted)).toBe('shared');
    expect((await readFile(keyFilePath)).equals(fileBefore)).toBe(true);
  });

  it('rewrites the key file when the keystore asks for re-encryption', async () => {
    const first = await createSafeStorageCipher({ keyFilePath, logService });
    const encrypted = first.encrypt('shared');
    expect((await readFile(keyFilePath)).toString().startsWith('v1:')).toBe(true);

    keystore.version = 'v2';
    keystore.shouldReEncrypt = true;
    const second = await createSafeStorageCipher({ keyFilePath, logService });

    expect((await readFile(keyFilePath)).toString().startsWith('v2:')).toBe(true);
    expect(second.decrypt(encrypted)).toBe('shared');
  });

  it('never overwrites an unwrappable key file and yields empty envelope values', async () => {
    const first = await createSafeStorageCipher({ keyFilePath, logService });
    const encrypted = first.encrypt('shared');
    const fileBefore = await readFile(keyFilePath);

    keystore.failDecrypt = true;
    const locked = await createSafeStorageCipher({ keyFilePath, logService });

    expect((await readFile(keyFilePath)).equals(fileBefore)).toBe(true);
    expect(locked.scheme).toBe('local-derived');
    expect(locked.decrypt(encrypted)).toBe('');
    expect(logService.errors.length).toBeGreaterThan(0);
    expect(decodeScheme(locked.encrypt('new'))).toBe('local-derived');

    keystore.failDecrypt = false;
    const restored = await createSafeStorageCipher({ keyFilePath, logService });
    expect(restored.decrypt(encrypted)).toBe('shared');
  });

  it('treats a key file of the wrong length as unwrappable and keeps it', async () => {
    await writeFile(keyFilePath, Buffer.from('v1:c2hvcnQ='));

    const cipher = await createSafeStorageCipher({ keyFilePath, logService });

    expect(cipher.scheme).toBe('local-derived');
    expect((await readFile(keyFilePath)).toString()).toBe('v1:c2hvcnQ=');
  });

  it('falls back to local-derived when the keystore is unavailable', async () => {
    keystore.available = false;

    const cipher = await createSafeStorageCipher({ keyFilePath, logService });
    const encrypted = cipher.encrypt('secret');

    expect(cipher.scheme).toBe('local-derived');
    expect(cipher.canRewrapLegacy).toBe(false);
    expect(decodeScheme(encrypted)).toBe('local-derived');
    expect(cipher.decrypt(encrypted)).toBe('secret');
    expect(logService.warnings.length).toBe(1);
    await expect(stat(keyFilePath)).rejects.toThrow();
  });

  it('returns empty for unmigrated legacy safe-storage payloads without throwing', async () => {
    const cipher = await createSafeStorageCipher({ keyFilePath, logService });
    const legacy = encodeSecretPayload({ scheme: 'safe-storage', ciphertext: 'AAAA' });

    expect(cipher.decrypt(legacy)).toBe('');
  });

  it('re-wraps a legacy token into the envelope scheme', async () => {
    const cipher = await createSafeStorageCipher({ keyFilePath, logService });
    // The fake keystore strips everything up to the first ':' when unwrapping.
    const legacy = encodeSecretPayload({ scheme: 'safe-storage', ciphertext: Buffer.from('legacy:old-secret').toString('base64') });

    const rewrapped = await cipher.rewrapLegacyToken(legacy);

    expect(rewrapped).not.toBeNull();
    expect(decodeScheme(rewrapped!)).toBe('safe-storage-envelope');
    expect(cipher.decrypt(rewrapped!)).toBe('old-secret');
    expect(await cipher.rewrapLegacyToken(rewrapped!)).toBeNull();
  });

  it('rejects unknown schemes', async () => {
    const cipher = await createSafeStorageCipher({ keyFilePath, logService });

    expect(() => cipher.decrypt(encodeSecretPayload({ scheme: 'mystery', ciphertext: 'AAAA' }))).toThrow(/Unknown scheme/);
  });
});

function decodeScheme(value: string): string {
  const body = value.slice('tmenc1:'.length);
  return (JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as { scheme: string }).scheme;
}
