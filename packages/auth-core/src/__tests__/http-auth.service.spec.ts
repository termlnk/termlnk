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

import type { IAuthKeyValueStorage, IDerivationMaterial, IMasterKey, IMasterKeyService, ISrpClientService, IUserAccount, IUserStorageService } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import type { HttpFetchFn } from '../services/http-auth.service';
import { Buffer } from 'node:buffer';
import { AuthState, MasterKeyState } from '@termlnk/auth';
import { BehaviorSubject } from 'rxjs';
import * as srpServer from 'secure-remote-password/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpAuthService } from '../services/http-auth.service';
import { SrpClientService } from '../services/srp-client.service';
import { TokenManager } from '../services/token-manager.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeMasterKeyService implements IMasterKeyService {
  readonly state$ = new BehaviorSubject<MasterKeyState>(MasterKeyState.Locked).asObservable();
  current: IMasterKey | null = null;
  derivedFor: { password: string; material: IDerivationMaterial } | null = null;
  lockCalls = 0;
  tryRestoreCalls = 0;
  clearPersistedCalls = 0;
  // When set, tryRestoreFromStorage() installs this key and returns true.
  pendingRestore: IMasterKey | null = null;

  async derive(password: string, material: IDerivationMaterial): Promise<IMasterKey> {
    this.derivedFor = { password, material };
    // deterministic 32-byte authKey based on password — lets us match SRP enrollments
    const authKeyBytes = Buffer.alloc(32);
    Buffer.from(password.padEnd(32, '.').slice(0, 32)).copy(authKeyBytes);
    const key: IMasterKey = {
      authKey: new Uint8Array(authKeyBytes),
      encKey: new Uint8Array(32).fill(2),
      indexKey: new Uint8Array(32).fill(3),
      email: material.email,
    };
    this.current = key;
    return key;
  }

  lock(): void {
    this.lockCalls++;
    this.current = null;
  }

  getCurrent(): IMasterKey | null {
    return this.current;
  }

  getState(): never {
    return AuthState.Unauthenticated as never;
  }

  async tryRestoreFromStorage(): Promise<boolean> {
    this.tryRestoreCalls++;
    if (this.pendingRestore) {
      this.current = this.pendingRestore;
      return true;
    }
    return false;
  }

  async clearPersistedKey(): Promise<void> {
    this.clearPersistedCalls++;
    this.pendingRestore = null;
  }
}

class FakeTokenStorage {
  data: { accessToken: string; refreshToken: string; accessTokenExpiresAt: number; refreshTokenExpiresAt: number } | null = null;
  async load() {
    return this.data;
  }

  async save(t: typeof this.data) {
    this.data = t;
  }

  async clear() {
    this.data = null;
  }
}

class FakeAuthKeyValueStorage implements IAuthKeyValueStorage {
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

class FakeUserStorage implements IUserStorageService {
  data: IUserAccount | null = null;
  async load(): Promise<IUserAccount | null> {
    return this.data;
  }

  async save(user: IUserAccount): Promise<void> {
    this.data = user;
  }

  async clear(): Promise<void> {
    this.data = null;
  }
}

class NeverRefresher {
  async refresh(): Promise<never> {
    throw new Error('refresher should not be called in these tests');
  }
}

interface IFetchCall {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

function makeFakeFetch(handlers: Array<(call: IFetchCall) => { status: number; json?: unknown; text?: string } | null>): {
  fetch: HttpFetchFn;
  calls: IFetchCall[];
} {
  const calls: IFetchCall[] = [];
  const fetch: HttpFetchFn = async (url, init) => {
    const call: IFetchCall = { url, init };
    calls.push(call);
    for (const handler of handlers) {
      const result = handler(call);
      if (result) {
        return {
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
          statusText: result.status === 200 ? 'OK' : 'Error',
          json: async () => result.json,
          text: async () => result.text ?? '',
        };
      }
    }
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
      text: async () => 'no handler matched',
    };
  };
  return { fetch, calls };
}

const TEST_USER: IUserAccount = {
  id: 'user-1',
  email: 'alice@example.com',
  emailVerified: true,
  createdAt: '2026-05-09T00:00:00Z',
  updatedAt: '2026-05-09T00:00:00Z',
};

interface ITestBed {
  masterKey: FakeMasterKeyService;
  srp: ISrpClientService;
  tokenManager: TokenManager;
  storage: FakeTokenStorage;
  authKv: FakeAuthKeyValueStorage;
  userStorage: FakeUserStorage;
}

function createTestBed(): ITestBed {
  const masterKey = new FakeMasterKeyService();
  const srp = new SrpClientService();
  const storage = new FakeTokenStorage();
  const tokenManager = new TokenManager(
    storage as never,
    new NeverRefresher() as never,
    new NoopLogService()
  );
  const authKv = new FakeAuthKeyValueStorage();
  const userStorage = new FakeUserStorage();
  return { masterKey, srp, tokenManager, storage, authKv, userStorage };
}

describe('HttpAuthService — register', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.tokenManager.dispose();
  });

  it('derives master key, builds SRP enrollment, and stores tokens on success', async () => {
    const tokens = {
      accessToken: 'a-1',
      refreshToken: 'r-1',
      accessTokenExpiresAt: Date.now() + 60_000,
      refreshTokenExpiresAt: Date.now() + 86_400_000,
    };
    const { fetch, calls } = makeFakeFetch([
      (call) => call.url.endsWith('/auth/register')
        ? { status: 200, json: { user: TEST_USER, ...tokens } }
        : null,
    ]);

    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.register({
      email: 'alice@example.com',
      password: 'correct-horse',
      displayName: 'Alice',
    });

    expect(auth.getCurrentUser()).toEqual(TEST_USER);
    expect(bed.userStorage.data).toEqual(TEST_USER);
    expect(bed.masterKey.derivedFor?.password).toBe('correct-horse');
    expect(bed.masterKey.derivedFor?.material.email).toBe('alice@example.com');
    expect(bed.storage.data?.accessToken).toBe('a-1');

    const body = JSON.parse(calls[0].init.body!);
    expect(body.email).toBe('alice@example.com');
    expect(body.displayName).toBe('Alice');
    expect(typeof body.argon2SaltB64).toBe('string');
    expect(body.argon2SaltB64.length).toBeGreaterThan(0);
    expect(typeof body.srpSalt).toBe('string');
    expect(typeof body.srpVerifier).toBe('string');

    auth.dispose();
  });

  it('classifies 409 as email_already_registered', async () => {
    const { fetch } = makeFakeFetch([
      (call) => call.url.endsWith('/auth/register') ? { status: 409, text: 'taken' } : null,
    ]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    let lastError: unknown = null;
    auth.lastError$.subscribe((e) => {
      lastError = e;
    });

    await expect(auth.register({ email: 'a@b.com', password: 'pw' })).rejects.toThrow();
    expect((lastError as { code: string } | null)?.code).toBe('email_already_registered');
    auth.dispose();
  });
});

describe('HttpAuthService — login (full SRP6a round-trip with simulated server)', () => {
  let bed: ITestBed;
  /** Server-side memory of (email → enrollment) — populated when register's wire body is observed. */
  let serverDb: Map<string, { argon2SaltB64: string; srpSalt: string; srpVerifier: string }>;

  beforeEach(() => {
    bed = createTestBed();
    serverDb = new Map();
  });

  afterEach(() => {
    bed.tokenManager.dispose();
  });

  it('register followed by login produces a matching session key on both sides', async () => {
    const tokens = {
      accessToken: 'after-login',
      refreshToken: 'r-after',
      accessTokenExpiresAt: Date.now() + 60_000,
      refreshTokenExpiresAt: Date.now() + 86_400_000,
    };

    /** Server side state for the in-flight SRP exchange. */
    let serverEphemeral: { secret: string; public: string } | null = null;

    const { fetch } = makeFakeFetch([
      // register: capture enrollment
      (call) => {
        if (!call.url.endsWith('/auth/register')) {
          return null;
        }
        const body = JSON.parse(call.init.body!);
        serverDb.set(body.email, {
          argon2SaltB64: body.argon2SaltB64,
          srpSalt: body.srpSalt,
          srpVerifier: body.srpVerifier,
        });
        return { status: 200, json: { user: TEST_USER, accessToken: 'r-token', refreshToken: 'r-refresh', accessTokenExpiresAt: 0, refreshTokenExpiresAt: 0 } };
      },
      // login init: return stored salts + server ephemeral
      (call) => {
        if (!call.url.endsWith('/auth/srp/init')) {
          return null;
        }
        const body = JSON.parse(call.init.body!);
        const enrollment = serverDb.get(body.email);
        if (!enrollment) {
          return { status: 404, text: 'no such user' };
        }
        serverEphemeral = srpServer.generateEphemeral(enrollment.srpVerifier);
        return {
          status: 200,
          json: {
            argon2SaltB64: enrollment.argon2SaltB64,
            srpSalt: enrollment.srpSalt,
            srpServerEphemeralPublic: serverEphemeral.public,
          },
        };
      },
      // login verify: complete handshake on server side
      (call) => {
        if (!call.url.endsWith('/auth/srp/verify')) {
          return null;
        }
        const body = JSON.parse(call.init.body!);
        const enrollment = serverDb.get(body.email);
        if (!enrollment || !serverEphemeral) {
          return { status: 401, text: 'no session' };
        }
        const session = srpServer.deriveSession(
          serverEphemeral.secret,
          body.clientPublicEphemeral,
          enrollment.srpSalt,
          body.email,
          enrollment.srpVerifier,
          body.clientSessionProof
        );
        return {
          status: 200,
          json: {
            serverSessionProof: session.proof,
            user: TEST_USER,
            ...tokens,
          },
        };
      },
    ]);

    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.register({ email: 'alice@example.com', password: 'shared-secret' });
    expect(serverDb.has('alice@example.com')).toBe(true);

    await auth.login({ email: 'alice@example.com', password: 'shared-secret' });
    expect(bed.storage.data?.accessToken).toBe('after-login');
    expect(auth.getCurrentUser()).toEqual(TEST_USER);
    expect(bed.userStorage.data).toEqual(TEST_USER);

    auth.dispose();
  }, 60_000);

  it('login with wrong password is rejected by the simulated server (SRP M1 check)', async () => {
    let serverEphemeral: { secret: string; public: string } | null = null;

    const { fetch } = makeFakeFetch([
      (call) => {
        if (!call.url.endsWith('/auth/register')) {
          return null;
        }
        const body = JSON.parse(call.init.body!);
        serverDb.set(body.email, {
          argon2SaltB64: body.argon2SaltB64,
          srpSalt: body.srpSalt,
          srpVerifier: body.srpVerifier,
        });
        return { status: 200, json: { user: TEST_USER, accessToken: 't', refreshToken: 't', accessTokenExpiresAt: 0, refreshTokenExpiresAt: 0 } };
      },
      (call) => {
        if (!call.url.endsWith('/auth/srp/init')) {
          return null;
        }
        const body = JSON.parse(call.init.body!);
        const enrollment = serverDb.get(body.email)!;
        serverEphemeral = srpServer.generateEphemeral(enrollment.srpVerifier);
        return {
          status: 200,
          json: {
            argon2SaltB64: enrollment.argon2SaltB64,
            srpSalt: enrollment.srpSalt,
            srpServerEphemeralPublic: serverEphemeral.public,
          },
        };
      },
      (call) => {
        if (!call.url.endsWith('/auth/srp/verify')) {
          return null;
        }
        const body = JSON.parse(call.init.body!);
        const enrollment = serverDb.get(body.email)!;
        try {
          srpServer.deriveSession(
            serverEphemeral!.secret,
            body.clientPublicEphemeral,
            enrollment.srpSalt,
            body.email,
            enrollment.srpVerifier,
            body.clientSessionProof
          );
          return { status: 200, json: {} };
        } catch {
          return { status: 401, text: 'invalid SRP proof' };
        }
      },
    ]);

    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.register({ email: 'alice@example.com', password: 'right-pw' });

    await expect(auth.login({ email: 'alice@example.com', password: 'wrong-pw' })).rejects.toThrow();
    expect(bed.masterKey.lockCalls).toBeGreaterThan(0); // partially-derived master key gets locked
    auth.dispose();
  }, 60_000);
});

describe('HttpAuthService — logout', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.tokenManager.dispose();
  });

  it('clears master key + tokens + currentUser even when server is unreachable', async () => {
    // Pre-populate token storage so logout has something to clear
    bed.storage.data = {
      accessToken: 'live',
      refreshToken: 'live-r',
      accessTokenExpiresAt: Date.now() + 60_000,
      refreshTokenExpiresAt: Date.now() + 60_000,
    };

    const { fetch } = makeFakeFetch([
      (call) => call.url.endsWith('/auth/logout') ? { status: 500, text: 'server down' } : null,
    ]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    bed.userStorage.data = { ...TEST_USER };

    await auth.logout();

    expect(bed.masterKey.lockCalls).toBeGreaterThan(0);
    // logout MUST drop the persisted wrap; otherwise the next launch would auto-restore
    // an authenticated session against the user's explicit will.
    expect(bed.masterKey.clearPersistedCalls).toBeGreaterThan(0);
    expect(bed.storage.data).toBeNull();
    expect(bed.userStorage.data).toBeNull();
    expect(auth.getCurrentUser()).toBeNull();
    auth.dispose();
  });

  it('skips server call when no access token is stored', async () => {
    const { fetch, calls } = makeFakeFetch([]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.logout();
    expect(calls).toHaveLength(0); // no token → no server hit
    auth.dispose();
  });
});

describe('HttpAuthService — restore', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.tokenManager.dispose();
  });

  function liveTokens() {
    return {
      accessToken: 'live-access',
      refreshToken: 'live-refresh',
      // Well outside the 30 s TokenManager refresh margin, so getAccessToken returns it as-is
      // without exercising the refresher.
      accessTokenExpiresAt: Date.now() + 600_000,
      refreshTokenExpiresAt: Date.now() + 86_400_000,
    };
  }

  it('emits cached user immediately and updates from /auth/me on success', async () => {
    bed.storage.data = liveTokens();
    bed.userStorage.data = { ...TEST_USER, displayName: 'stale name' };

    const freshUser: IUserAccount = { ...TEST_USER, displayName: 'fresh name', emailVerified: false };
    const { fetch, calls } = makeFakeFetch([
      (call) => call.url.endsWith('/auth/me') && call.init.method === 'GET'
        ? { status: 200, json: { user: freshUser } }
        : null,
    ]);

    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    const userEmissions: Array<IUserAccount | null> = [];
    const stateEmissions: AuthState[] = [];
    const userSub = auth.currentUser$.subscribe((u) => userEmissions.push(u));
    const stateSub = auth.authState$.subscribe((s) => stateEmissions.push(s));

    await auth.restore();

    expect(calls[0].init.headers?.Authorization).toBe('Bearer live-access');
    expect(auth.getCurrentUser()).toEqual(freshUser);
    expect(bed.userStorage.data).toEqual(freshUser);
    // First emission is cached, last is fresh — proves the fast-path → self-heal sequence.
    expect(userEmissions[1]).toEqual({ ...TEST_USER, displayName: 'stale name' });
    expect(userEmissions[userEmissions.length - 1]).toEqual(freshUser);
    expect(stateEmissions).toContain(AuthState.Authenticated);
    // After a successful /auth/me, the master key restore path runs so sync can encrypt
    // immediately without forcing a re-login.
    expect(bed.masterKey.tryRestoreCalls).toBe(1);

    userSub.unsubscribe();
    stateSub.unsubscribe();
    auth.dispose();
  });

  it('keeps cached user when /auth/me returns 404 (endpoint not deployed yet)', async () => {
    bed.storage.data = liveTokens();
    bed.userStorage.data = { ...TEST_USER };

    const { fetch } = makeFakeFetch([
      (call) => call.url.endsWith('/auth/me') ? { status: 404, text: 'not found' } : null,
    ]);

    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.restore();

    expect(auth.getCurrentUser()).toEqual(TEST_USER);
    expect(bed.userStorage.data).toEqual(TEST_USER);
    expect(bed.storage.data?.accessToken).toBe('live-access');
    auth.dispose();
  });

  it('keeps cached user when /auth/me throws a network error', async () => {
    bed.storage.data = liveTokens();
    bed.userStorage.data = { ...TEST_USER };

    const failingFetch: HttpFetchFn = async () => {
      throw new TypeError('fetch failed');
    };
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: failingFetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.restore();

    expect(auth.getCurrentUser()).toEqual(TEST_USER);
    expect(bed.userStorage.data).toEqual(TEST_USER);
    expect(bed.storage.data?.accessToken).toBe('live-access');
    auth.dispose();
  });

  it('clears session when /auth/me returns 401 (server revoked the token)', async () => {
    bed.storage.data = liveTokens();
    bed.userStorage.data = { ...TEST_USER };

    const { fetch } = makeFakeFetch([
      (call) => call.url.endsWith('/auth/me') ? { status: 401, text: 'revoked' } : null,
    ]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.restore();

    expect(auth.getCurrentUser()).toBeNull();
    expect(bed.userStorage.data).toBeNull();
    expect(bed.storage.data).toBeNull();
    expect(bed.masterKey.lockCalls).toBeGreaterThan(0);
    // Server-revoked path must also nuke the persisted wrap so the next launch cannot
    // auto-restore into a session the server no longer trusts.
    expect(bed.masterKey.clearPersistedCalls).toBeGreaterThan(0);
    auth.dispose();
  });

  it('fetches and persists user when token is live but no cached user exists', async () => {
    bed.storage.data = liveTokens();
    // userStorage.data stays null — simulates a partial-write scenario between releases.

    const { fetch } = makeFakeFetch([
      (call) => call.url.endsWith('/auth/me') ? { status: 200, json: { user: TEST_USER } } : null,
    ]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.restore();

    expect(auth.getCurrentUser()).toEqual(TEST_USER);
    expect(bed.userStorage.data).toEqual(TEST_USER);
    auth.dispose();
  });

  it('clears cached user when no token is present (fail-soft drop)', async () => {
    // No tokens stored; TokenManager.getAccessToken returns null on first call.
    bed.userStorage.data = { ...TEST_USER };

    const { fetch, calls } = makeFakeFetch([]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    await auth.restore();

    expect(calls).toHaveLength(0); // no /auth/me hit when there's no token
    expect(auth.getCurrentUser()).toBeNull();
    expect(bed.userStorage.data).toBeNull();
    auth.dispose();
  });

  it('is a noop when neither cached user nor token exist', async () => {
    const { fetch, calls } = makeFakeFetch([]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    const stateEmissions: AuthState[] = [];
    const stateSub = auth.authState$.subscribe((s) => stateEmissions.push(s));

    await auth.restore();

    expect(calls).toHaveLength(0);
    expect(auth.getCurrentUser()).toBeNull();
    expect(bed.userStorage.data).toBeNull();
    expect(stateEmissions).toEqual([AuthState.Restoring, AuthState.Unauthenticated]);
    stateSub.unsubscribe();
    auth.dispose();
  });
});

describe('HttpAuthService — getAccessToken', () => {
  it('forwards to TokenManager.getAccessToken', async () => {
    const bed = createTestBed();
    bed.storage.data = {
      accessToken: 'forwarded-token',
      refreshToken: 'r',
      accessTokenExpiresAt: Date.now() + 60_000,
      refreshTokenExpiresAt: Date.now() + 60_000,
    };
    const { fetch } = makeFakeFetch([]);
    const auth = new HttpAuthService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      bed.masterKey,
      bed.srp,
      bed.tokenManager,
      bed.authKv,
      bed.userStorage,
      new NoopLogService()
    );

    expect(await auth.getAccessToken()).toBe('forwarded-token');
    auth.dispose();
    bed.tokenManager.dispose();
  });
});
