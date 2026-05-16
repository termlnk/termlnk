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

import type { IAuthKeyValueStorage, IUserAccount } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UserStorageService } from '../services/user-storage.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class InMemoryAuthKeyValueStorage implements IAuthKeyValueStorage {
  store = new Map<string, string>();

  async getString(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async setString(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async deleteKey(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const SAMPLE_USER: IUserAccount = {
  id: 'user-abc',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: 'https://cdn.example/alice.png',
  emailVerified: true,
  createdAt: '2026-05-09T00:00:00Z',
  updatedAt: '2026-05-14T12:34:56Z',
};

describe('UserStorageService', () => {
  let storage: InMemoryAuthKeyValueStorage;
  let service: UserStorageService;

  beforeEach(() => {
    storage = new InMemoryAuthKeyValueStorage();
    service = new UserStorageService(storage, new NoopLogService());
  });

  afterEach(() => {
    service.dispose();
  });

  it('load returns null when nothing has been saved', async () => {
    expect(await service.load()).toBeNull();
  });

  it('save then load round-trips IUserAccount through the storage backend', async () => {
    await service.save(SAMPLE_USER);
    const loaded = await service.load();
    expect(loaded).toEqual(SAMPLE_USER);
  });

  it('persists the serialized user JSON under the `user` key', async () => {
    await service.save(SAMPLE_USER);
    const stored = storage.store.get('user');
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toEqual(SAMPLE_USER);
  });

  it('clear removes the persisted key; subsequent load returns null', async () => {
    await service.save(SAMPLE_USER);
    await service.clear();
    expect(await service.load()).toBeNull();
  });

  it('save overwrites prior user', async () => {
    await service.save(SAMPLE_USER);
    const updated: IUserAccount = { ...SAMPLE_USER, displayName: 'Alice Rev2' };
    await service.save(updated);
    const loaded = await service.load();
    expect(loaded?.displayName).toBe('Alice Rev2');
  });

  it('returns null (not throws) when stored value is unparseable JSON', async () => {
    await storage.setString('user', '{not json');
    expect(await service.load()).toBeNull();
  });
});
