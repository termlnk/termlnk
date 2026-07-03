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

import type { IArgon2idParams, IAuthKeyValueStorage, IPasswordHasher } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import { Buffer } from 'node:buffer';
import { IAuthKeyValueStorage as IAuthKeyValueStorageId, IPasswordHasher as IPasswordHasherId, MasterKeyState } from '@termlnk/auth';
import { ILogService as ILogServiceId, Injector } from '@termlnk/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MasterKeyService } from '../services/master-key.service';

const TEST_EMAIL = 'alice@example.com';
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_SALT_B64 = Buffer.from('static-test-salt-32-bytes-fixed!').toString('base64');
const WRAPPED_KEY_STORAGE_KEY = 'wrappedMasterKey';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

// Deterministic, fast hasher: produces a 32-byte output derived from password+salt by
// concatenating their first 32 hashed bytes. Sufficient for testing state transitions,
// determinism, and zeroize — the real Argon2id properties live in kdf.spec.ts.
class FakePasswordHasher implements IPasswordHasher {
  async argon2id(password: string, salt: Uint8Array, params: IArgon2idParams): Promise<Uint8Array> {
    const passwordBytes = new TextEncoder().encode(password);
    const out = new Uint8Array(params.outputBytes);
    for (let i = 0; i < params.outputBytes; i++) {
      const pb = passwordBytes[i % passwordBytes.length] ?? 0;
      const sb = salt[i % salt.length] ?? 0;
      out[i] = (pb ^ sb ^ (i * 31)) & 0xFF;
    }
    return out;
  }
}

class FakeAuthKeyValueStorage implements IAuthKeyValueStorage {
  readonly map = new Map<string, string>();
  async getString(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async setString(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async deleteKey(key: string): Promise<void> {
    this.map.delete(key);
  }
}

interface ITestBed {
  injector: Injector;
  service: MasterKeyService;
  storage: FakeAuthKeyValueStorage;
}

function createTestBed(): ITestBed {
  const injector = new Injector();
  const storage = new FakeAuthKeyValueStorage();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  injector.add([IPasswordHasherId, { useClass: FakePasswordHasher }]);
  injector.add([IAuthKeyValueStorageId, { useValue: storage }]);
  injector.add([MasterKeyService]);
  return { injector, service: injector.get(MasterKeyService), storage };
}

describe('MasterKeyService', () => {
  let injector: Injector;
  let service: MasterKeyService;
  let storage: FakeAuthKeyValueStorage;

  beforeEach(() => {
    ({ injector, service, storage } = createTestBed());
  });

  afterEach(() => {
    injector.dispose();
  });

  it('starts in Locked state with no current key', () => {
    expect(service.getState()).toBe(MasterKeyState.Locked);
    expect(service.getCurrent()).toBeNull();
  });

  it('emits the current state synchronously to new subscribers', () => {
    const seen: MasterKeyState[] = [];
    const sub = service.state$.subscribe((s) => seen.push(s));
    expect(seen).toEqual([MasterKeyState.Locked]);
    sub.unsubscribe();
  });

  it('derive() is pure: returns three 32-byte sub keys without touching state or storage', async () => {
    const transitions: MasterKeyState[] = [];
    const sub = service.state$.subscribe((s) => transitions.push(s));

    const key = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });

    // Pure derivation: still locked, no active key, nothing persisted.
    expect(service.getState()).toBe(MasterKeyState.Locked);
    expect(service.getCurrent()).toBeNull();
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(false);
    expect(key.email).toBe(TEST_EMAIL);
    expect(key.authKey.length).toBe(32);
    expect(key.encKey.length).toBe(32);
    expect(key.indexKey.length).toBe(32);
    expect(transitions).toEqual([MasterKeyState.Locked]);

    sub.unsubscribe();
  }, 30_000);

  it('activate() installs the key, publishes Unlocked and persists the wrap', async () => {
    const key = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    const transitions: MasterKeyState[] = [];
    const sub = service.state$.subscribe((s) => transitions.push(s));

    await service.activate(key);

    expect(service.getState()).toBe(MasterKeyState.Unlocked);
    expect(service.getCurrent()).toBe(key);
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(true);
    expect(transitions).toEqual([MasterKeyState.Locked, MasterKeyState.Unlocked]);

    sub.unsubscribe();
  }, 30_000);

  it('activate() rejects an incomplete key', async () => {
    await expect(
      service.activate({ email: '', authKey: new Uint8Array(32), encKey: new Uint8Array(32), indexKey: new Uint8Array(32) })
    ).rejects.toThrow(/incomplete/i);
    expect(service.getState()).toBe(MasterKeyState.Locked);
  });

  it('derive() is deterministic — same password + material yields identical sub keys', async () => {
    const a = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    const aSnapshot = {
      authKey: new Uint8Array(a.authKey),
      encKey: new Uint8Array(a.encKey),
      indexKey: new Uint8Array(a.indexKey),
    };

    const b = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });

    expect(b.authKey).toEqual(aSnapshot.authKey);
    expect(b.encKey).toEqual(aSnapshot.encKey);
    expect(b.indexKey).toEqual(aSnapshot.indexKey);
  }, 60_000);

  it('lock() clears state and zeroes the previously held key buffers', async () => {
    const key = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    await service.activate(key);
    const transitions: MasterKeyState[] = [];

    expect(key.authKey.some((b) => b !== 0)).toBe(true);

    const sub = service.state$.subscribe((s) => transitions.push(s));
    service.lock();

    expect(service.getState()).toBe(MasterKeyState.Locked);
    expect(service.getCurrent()).toBeNull();
    expect(transitions).toEqual([MasterKeyState.Unlocked, MasterKeyState.Locked]);
    expect(Array.from(key.authKey).every((b) => b === 0)).toBe(true);
    expect(Array.from(key.encKey).every((b) => b === 0)).toBe(true);
    expect(Array.from(key.indexKey).every((b) => b === 0)).toBe(true);

    sub.unsubscribe();
  }, 30_000);

  it('lock() is idempotent and a no-op when already locked', () => {
    const transitions: MasterKeyState[] = [];
    const sub = service.state$.subscribe((s) => transitions.push(s));

    service.lock();
    service.lock();

    expect(transitions).toEqual([MasterKeyState.Locked]);
    sub.unsubscribe();
  });

  it('rejects empty password and missing material', async () => {
    await expect(
      service.derive('', { email: TEST_EMAIL, saltB64: TEST_SALT_B64 })
    ).rejects.toThrow(/non-empty/i);

    await expect(
      service.derive(TEST_PASSWORD, { email: '', saltB64: TEST_SALT_B64 })
    ).rejects.toThrow(/email/i);

    await expect(
      service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: '' })
    ).rejects.toThrow(/saltB64/i);
  });

  it('activating a new key zeroes the previous one before storing the new one', async () => {
    const first = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    await service.activate(first);
    const otherSaltB64 = Buffer.from('alt-server-salt-32bytes-padding!').toString('base64');
    const second = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: otherSaltB64 });
    // Deriving alone must not disturb the active key (transactional flows depend on it).
    expect(service.getCurrent()).toBe(first);
    expect(first.authKey.some((b) => b !== 0)).toBe(true);

    await service.activate(second);

    expect(Array.from(first.authKey).every((b) => b === 0)).toBe(true);
    expect(Array.from(first.encKey).every((b) => b === 0)).toBe(true);
    expect(Array.from(first.indexKey).every((b) => b === 0)).toBe(true);
    expect(second.authKey.some((b) => b !== 0)).toBe(true);
    expect(service.getCurrent()).toBe(second);
  }, 60_000);

  it('dispose() zeroes the held key and completes state$', async () => {
    await service.activate(await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    let completed = false;
    const sub = service.state$.subscribe({
      complete: () => {
        completed = true;
      },
    });

    service.dispose();

    expect(completed).toBe(true);
    expect(service.getCurrent()).toBeNull();
    sub.unsubscribe();
  }, 30_000);

  it('activate() persists a wrapped blob containing all three sub keys', async () => {
    await service.activate(await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));

    const raw = storage.map.get(WRAPPED_KEY_STORAGE_KEY);
    expect(raw).toBeDefined();
    const blob = JSON.parse(raw!) as { email: string; authKey: string; encKey: string; indexKey: string };
    expect(blob.email).toBe(TEST_EMAIL);
    expect(typeof blob.authKey).toBe('string');
    expect(typeof blob.encKey).toBe('string');
    expect(typeof blob.indexKey).toBe('string');
    // base64 of 32 bytes is 44 chars (with padding).
    expect(blob.authKey.length).toBeGreaterThanOrEqual(43);
  }, 30_000);

  it('tryRestoreFromStorage() round-trips: activate → simulate restart → restored key matches', async () => {
    const original = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    await service.activate(original);
    const authSnapshot = new Uint8Array(original.authKey);
    const encSnapshot = new Uint8Array(original.encKey);
    const indexSnapshot = new Uint8Array(original.indexKey);

    // Simulate process restart: drop the in-memory key but keep the persisted blob.
    service.lock();
    expect(service.getCurrent()).toBeNull();

    const restored = await service.tryRestoreFromStorage();
    expect(restored).toBe(true);
    expect(service.getState()).toBe(MasterKeyState.Unlocked);
    const current = service.getCurrent()!;
    expect(current.email).toBe(TEST_EMAIL);
    expect(current.authKey).toEqual(authSnapshot);
    expect(current.encKey).toEqual(encSnapshot);
    expect(current.indexKey).toEqual(indexSnapshot);
  }, 60_000);

  it('tryRestoreFromStorage() returns false and self-heals when the blob is corrupt', async () => {
    storage.map.set(WRAPPED_KEY_STORAGE_KEY, '{not valid json');

    const ok = await service.tryRestoreFromStorage();

    expect(ok).toBe(false);
    expect(service.getState()).toBe(MasterKeyState.Locked);
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(false);
  });

  it('tryRestoreFromStorage() returns false when no wrap exists', async () => {
    expect(await service.tryRestoreFromStorage()).toBe(false);
    expect(service.getState()).toBe(MasterKeyState.Locked);
  });

  it('lock() does NOT remove the persisted wrap — restart can still restore', async () => {
    await service.activate(await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(true);

    service.lock();
    expect(service.getCurrent()).toBeNull();
    // Wrap survives lock — that is the whole point of OS-keystore persistence.
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(true);

    const restored = await service.tryRestoreFromStorage();
    expect(restored).toBe(true);
    expect(service.getState()).toBe(MasterKeyState.Unlocked);
  }, 30_000);

  it('clearPersistedKey() removes the wrap so tryRestoreFromStorage returns false next time', async () => {
    await service.activate(await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 }));
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(true);

    await service.clearPersistedKey();
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(false);

    service.lock();
    expect(await service.tryRestoreFromStorage()).toBe(false);
  }, 30_000);

  it('clearPersistedKey() is idempotent and a no-op when no wrap exists', async () => {
    await service.clearPersistedKey();
    await service.clearPersistedKey();
    expect(storage.map.has(WRAPPED_KEY_STORAGE_KEY)).toBe(false);
  });
});
