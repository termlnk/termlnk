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
import { MasterKeyState } from '@termlnk/auth';
import { ILogService as ILogServiceId, Injector } from '@termlnk/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MasterKeyService } from '../services/master-key.service';

const TEST_EMAIL = 'alice@example.com';
const TEST_PASSWORD = 'correct horse battery staple';
const TEST_SALT_B64 = Buffer.from('static-test-salt-32-bytes-fixed!').toString('base64');

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

function createTestBed(): { injector: Injector; service: MasterKeyService } {
  const injector = new Injector();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  injector.add([MasterKeyService]);
  return { injector, service: injector.get(MasterKeyService) };
}

describe('MasterKeyService', () => {
  let injector: Injector;
  let service: MasterKeyService;

  beforeEach(() => {
    ({ injector, service } = createTestBed());
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

  it('derive() unlocks and exposes three 32-byte sub keys plus the email', async () => {
    const transitions: MasterKeyState[] = [];
    const sub = service.state$.subscribe((s) => transitions.push(s));

    const key = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });

    expect(service.getState()).toBe(MasterKeyState.Unlocked);
    expect(service.getCurrent()).toBe(key);
    expect(key.email).toBe(TEST_EMAIL);
    expect(key.authKey.length).toBe(32);
    expect(key.encKey.length).toBe(32);
    expect(key.indexKey.length).toBe(32);
    expect(transitions).toEqual([MasterKeyState.Locked, MasterKeyState.Unlocked]);

    sub.unsubscribe();
  }, 30_000);

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

  it('re-deriving zeroes the previous key before storing the new one', async () => {
    const first = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
    const otherSaltB64 = Buffer.from('alt-server-salt-32bytes-padding!').toString('base64');
    const second = await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: otherSaltB64 });

    expect(Array.from(first.authKey).every((b) => b === 0)).toBe(true);
    expect(Array.from(first.encKey).every((b) => b === 0)).toBe(true);
    expect(Array.from(first.indexKey).every((b) => b === 0)).toBe(true);
    expect(second.authKey.some((b) => b !== 0)).toBe(true);
    expect(service.getCurrent()).toBe(second);
  }, 60_000);

  it('dispose() zeroes the held key and completes state$', async () => {
    await service.derive(TEST_PASSWORD, { email: TEST_EMAIL, saltB64: TEST_SALT_B64 });
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
});
