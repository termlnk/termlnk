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
import { IAuthKeyValueStorage, IMasterKeyService, IPasswordHasher } from '@termlnk/auth';
import { HashWasmPasswordHasher, MasterKeyService } from '@termlnk/auth-core';
import { ILogService as ILogServiceId, Injector } from '@termlnk/core';
import { SYNC_PAYLOAD_PREFIX } from '@termlnk/sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncCryptoService } from '../services/crypto.service';

const TEST_EMAIL = 'alice@example.com';
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_SALT_B64 = Buffer.from('static-test-salt-32-bytes-fixed!').toString('base64');
const PREFIX_BYTES = new TextEncoder().encode(SYNC_PAYLOAD_PREFIX);
const NONCE_LEN = 24;
const TAG_LEN = 16;

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class InMemoryAuthKeyValueStorage implements IAuthKeyValueStorage {
  private readonly _map = new Map<string, string>();
  async getString(key: string): Promise<string | null> {
    return this._map.get(key) ?? null;
  }

  async setString(key: string, value: string): Promise<void> {
    this._map.set(key, value);
  }

  async deleteKey(key: string): Promise<void> {
    this._map.delete(key);
  }
}

interface ITestBed {
  injector: Injector;
  masterKeyService: MasterKeyService;
  cryptoService: SyncCryptoService;
}

function createTestBed(): ITestBed {
  const injector = new Injector();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  // MasterKeyService takes IPasswordHasher as a constructor dep so React Native can
  // swap in a native Argon2id binding. Tests stay on the WebAssembly default under Node.
  injector.add([IPasswordHasher, { useClass: HashWasmPasswordHasher }]);
  // MasterKeyService persists the wrapped key via IAuthKeyValueStorage so restart can
  // auto-restore. Tests use an in-memory fake — no platform keystore involvement.
  injector.add([IAuthKeyValueStorage, { useClass: InMemoryAuthKeyValueStorage }]);
  injector.add([IMasterKeyService, { useClass: MasterKeyService }]);
  injector.add([SyncCryptoService]);

  return {
    injector,
    masterKeyService: injector.get(IMasterKeyService) as MasterKeyService,
    cryptoService: injector.get(SyncCryptoService),
  };
}

describe('SyncCryptoService', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.injector.dispose();
  });

  it('reports unavailable while master key is locked', () => {
    expect(bed.cryptoService.available).toBe(false);
  });

  it('throws on encrypt/decrypt/hmacIndex while locked', () => {
    expect(() => bed.cryptoService.encrypt(new Uint8Array([1, 2, 3]))).toThrow(/locked/i);
    expect(() => bed.cryptoService.decrypt(new Uint8Array([1, 2, 3]))).toThrow(/locked/i);
    expect(() => bed.cryptoService.hmacIndex('foo')).toThrow(/locked/i);
  });

  it('reports available after master key is derived', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    expect(bed.cryptoService.available).toBe(true);
  }, 30_000);

  it('encrypts to a tmsync1: framed payload of expected layout', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));

    const plaintext = new TextEncoder().encode('hello world');
    const sealed = bed.cryptoService.encrypt(plaintext);

    expect(sealed.length).toBe(PREFIX_BYTES.length + NONCE_LEN + plaintext.length + TAG_LEN);
    expect(sealed.subarray(0, PREFIX_BYTES.length)).toEqual(PREFIX_BYTES);
  }, 30_000);

  it('round-trips arbitrary bytes', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));

    for (const sample of [
      new Uint8Array(0),
      new Uint8Array([0]),
      new TextEncoder().encode('🦄 unicode + ascii mix'),
      new Uint8Array(4096).map((_, i) => i & 0xFF),
    ]) {
      const sealed = bed.cryptoService.encrypt(sample);
      const recovered = bed.cryptoService.decrypt(sealed);
      expect(recovered).toEqual(sample);
    }
  }, 30_000);

  it('uses a fresh random nonce per encrypt — same plaintext yields different ciphertexts', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));

    const plaintext = new TextEncoder().encode('repeat me');
    const a = bed.cryptoService.encrypt(plaintext);
    const b = bed.cryptoService.encrypt(plaintext);

    expect(a).not.toEqual(b);
    // Both still decrypt to the same plaintext
    expect(bed.cryptoService.decrypt(a)).toEqual(plaintext);
    expect(bed.cryptoService.decrypt(b)).toEqual(plaintext);
  }, 30_000);

  it('rejects payloads missing the tmsync1: prefix', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    const garbage = new Uint8Array(64).fill(0xAB);
    expect(() => bed.cryptoService.decrypt(garbage)).toThrow(/prefix/i);
  }, 30_000);

  it('rejects payloads shorter than minimum frame length', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    const tooShort = new Uint8Array(PREFIX_BYTES.length + NONCE_LEN + TAG_LEN - 1);
    expect(() => bed.cryptoService.decrypt(tooShort)).toThrow(/too short/i);
  }, 30_000);

  it('rejects ciphertext when any byte is tampered (Poly1305 detection)', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));

    const plaintext = new TextEncoder().encode('tamper-detect');
    const sealed = bed.cryptoService.encrypt(plaintext);

    // Flip a bit inside the ciphertext region (after prefix + nonce)
    const tampered = new Uint8Array(sealed);
    tampered[PREFIX_BYTES.length + NONCE_LEN] ^= 0x01;

    expect(() => bed.cryptoService.decrypt(tampered)).toThrow();
  }, 30_000);

  it('rejects ciphertext encrypted with a different master key', async () => {
    // First instance encrypts
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    const sealed = bed.cryptoService.encrypt(new TextEncoder().encode('cross-account'));

    // Re-derive with a different password — now key differs
    await bed.masterKeyService.activate(await bed.masterKeyService.derive('different-password', { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));

    expect(() => bed.cryptoService.decrypt(sealed)).toThrow();
  }, 60_000);

  it('hmacIndex is deterministic for identical inputs', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    const a = bed.cryptoService.hmacIndex('hostA@vpn.example.com');
    const b = bed.cryptoService.hmacIndex('hostA@vpn.example.com');
    expect(a).toEqual(b);
    expect(a.length).toBe(32);
  }, 30_000);

  it('hmacIndex differs across distinct values', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    const a = bed.cryptoService.hmacIndex('alice');
    const b = bed.cryptoService.hmacIndex('bob');
    expect(a).not.toEqual(b);
  }, 30_000);

  it('hmacIndex changes when master key changes (different account)', async () => {
    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    const a = bed.cryptoService.hmacIndex('shared-value');

    await bed.masterKeyService.activate(await bed.masterKeyService.derive(TEST_PASSWORD, { email: 'bob@example.com', saltB64: TEST_SALT_B64 }));
    const b = bed.cryptoService.hmacIndex('shared-value');

    expect(a).not.toEqual(b);
  }, 60_000);
});
