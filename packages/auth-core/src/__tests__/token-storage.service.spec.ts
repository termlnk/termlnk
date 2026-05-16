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

import type { IAuthKeyValueStorage, ITokenPair } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TokenStorageService } from '../services/token-storage.service';

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

const SAMPLE_TOKENS: ITokenPair = {
  accessToken: 'access.jwt.token',
  refreshToken: 'refresh.jwt.token',
  accessTokenExpiresAt: 1_700_000_000_000 + 15 * 60 * 1000,
  refreshTokenExpiresAt: 1_700_000_000_000 + 30 * 24 * 60 * 60 * 1000,
};

describe('TokenStorageService', () => {
  let storage: InMemoryAuthKeyValueStorage;
  let service: TokenStorageService;

  beforeEach(() => {
    storage = new InMemoryAuthKeyValueStorage();
    service = new TokenStorageService(storage, new NoopLogService());
  });

  afterEach(() => {
    service.dispose();
  });

  it('load returns null when nothing has been saved', async () => {
    expect(await service.load()).toBeNull();
  });

  it('save then load round-trips ITokenPair through the storage backend', async () => {
    await service.save(SAMPLE_TOKENS);
    const loaded = await service.load();
    expect(loaded).toEqual(SAMPLE_TOKENS);
  });

  it('persists the serialized token JSON under the `tokens` key', async () => {
    await service.save(SAMPLE_TOKENS);
    const stored = storage.store.get('tokens');
    expect(stored).toBeDefined();
    expect(JSON.parse(stored!)).toEqual(SAMPLE_TOKENS);
  });

  it('clear removes the persisted key; subsequent load returns null', async () => {
    await service.save(SAMPLE_TOKENS);
    await service.clear();
    expect(await service.load()).toBeNull();
  });

  it('save overwrites prior tokens', async () => {
    await service.save(SAMPLE_TOKENS);
    const updated: ITokenPair = { ...SAMPLE_TOKENS, accessToken: 'rotated.access' };
    await service.save(updated);
    const loaded = await service.load();
    expect(loaded?.accessToken).toBe('rotated.access');
  });

  it('returns null (not throws) when stored value is unparseable JSON', async () => {
    await storage.setString('tokens', '{not json');
    expect(await service.load()).toBeNull();
  });
});
