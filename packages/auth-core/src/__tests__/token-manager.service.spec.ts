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

import type { ITokenPair, ITokenRefresher, ITokenStorageService } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenManager } from '../services/token-manager.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeStorage implements ITokenStorageService {
  data: ITokenPair | null = null;
  loadCount = 0;
  saveCount = 0;
  clearCount = 0;

  async load(): Promise<ITokenPair | null> {
    this.loadCount++;
    return this.data;
  }

  async save(tokens: ITokenPair): Promise<void> {
    this.saveCount++;
    this.data = tokens;
  }

  async clear(): Promise<void> {
    this.clearCount++;
    this.data = null;
  }
}

class FakeRefresher implements ITokenRefresher {
  callCount = 0;
  next: ITokenPair | null = null;
  error: Error | null = null;
  /** Promise to await before resolving — for concurrency tests */
  gate: Promise<void> | null = null;

  async refresh(_refreshToken: string): Promise<ITokenPair> {
    this.callCount++;
    if (this.gate) {
      await this.gate;
    }
    if (this.error) {
      throw this.error;
    }
    if (!this.next) {
      throw new Error('FakeRefresher: no next token configured');
    }
    return this.next;
  }
}

function makeTokens(overrides: Partial<ITokenPair> = {}): ITokenPair {
  const now = Date.now();
  return {
    accessToken: 'access.v1',
    refreshToken: 'refresh.v1',
    accessTokenExpiresAt: now + 15 * 60 * 1000,
    refreshTokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

describe('TokenManager', () => {
  let storage: FakeStorage;
  let refresher: FakeRefresher;
  let manager: TokenManager;

  beforeEach(() => {
    storage = new FakeStorage();
    refresher = new FakeRefresher();
    manager = new TokenManager(storage, refresher, new NoopLogService());
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('returns null when no tokens are stored', async () => {
    expect(await manager.getAccessToken()).toBeNull();
    expect(refresher.callCount).toBe(0);
  });

  it('returns the stored access token while it is comfortably valid', async () => {
    storage.data = makeTokens({ accessToken: 'fresh.access' });
    expect(await manager.getAccessToken()).toBe('fresh.access');
    expect(refresher.callCount).toBe(0);
  });

  it('caches the storage load — second getAccessToken does not re-read from disk', async () => {
    storage.data = makeTokens();
    await manager.getAccessToken();
    await manager.getAccessToken();
    expect(storage.loadCount).toBe(1);
  });

  it('proactively refreshes when the access token is within the 30 s margin', async () => {
    const now = Date.now();
    storage.data = makeTokens({ accessToken: 'expiring', accessTokenExpiresAt: now + 5_000 });
    refresher.next = makeTokens({ accessToken: 'rotated', accessTokenExpiresAt: now + 15 * 60_000 });

    expect(await manager.getAccessToken()).toBe('rotated');
    expect(refresher.callCount).toBe(1);
    expect(storage.data?.accessToken).toBe('rotated');
  });

  it('coalesces concurrent refreshes — many getAccessToken calls share a single in-flight refresh', async () => {
    const now = Date.now();
    storage.data = makeTokens({ accessToken: 'expiring', accessTokenExpiresAt: now - 1_000 });
    refresher.next = makeTokens({ accessToken: 'rotated', accessTokenExpiresAt: now + 15 * 60_000 });

    let release: () => void = () => {};
    refresher.gate = new Promise((res) => {
      release = res;
    });

    const calls = Promise.all([
      manager.getAccessToken(),
      manager.getAccessToken(),
      manager.getAccessToken(),
    ]);

    // Allow the refresh to complete
    release();
    const results = await calls;

    expect(results).toEqual(['rotated', 'rotated', 'rotated']);
    expect(refresher.callCount).toBe(1);
  });

  it('returns null and clears local state when the refresh token has expired', async () => {
    const now = Date.now();
    storage.data = makeTokens({
      accessTokenExpiresAt: now - 60_000,
      refreshTokenExpiresAt: now - 1_000,
    });

    expect(await manager.getAccessToken()).toBeNull();
    expect(refresher.callCount).toBe(0); // Did not even attempt — refresh token is dead
    expect(storage.data).toBeNull();
    expect(storage.clearCount).toBeGreaterThan(0);
  });

  it('returns null and clears state when the refresher itself fails', async () => {
    const now = Date.now();
    storage.data = makeTokens({ accessTokenExpiresAt: now - 1_000 });
    refresher.error = new Error('refresh token revoked');

    expect(await manager.getAccessToken()).toBeNull();
    expect(refresher.callCount).toBe(1);
    expect(storage.data).toBeNull();
  });

  it('setTokens updates both cache and storage', async () => {
    const tokens = makeTokens({ accessToken: 'set.token' });
    await manager.setTokens(tokens);

    expect(manager.peekCached()).toEqual(tokens);
    expect(storage.data).toEqual(tokens);
  });

  it('clear empties the cache and the underlying storage', async () => {
    await manager.setTokens(makeTokens());
    expect(manager.peekCached()).not.toBeNull();

    await manager.clear();

    expect(manager.peekCached()).toBeNull();
    expect(storage.data).toBeNull();
  });

  it('dispose clears the in-memory cache so token references can be GC\'d', async () => {
    await manager.setTokens(makeTokens());
    manager.dispose();
    expect(manager.peekCached()).toBeNull();
  });
});
