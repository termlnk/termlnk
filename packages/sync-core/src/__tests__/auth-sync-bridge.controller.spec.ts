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

import type { IAuthError, IAuthService, IMasterKey, IMasterKeyService, IUserAccount } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { AuthState, MasterKeyState } from '@termlnk/auth';
import { ConfigService } from '@termlnk/core';
import { SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSyncBridgeController } from '../controllers/auth-sync-bridge.controller';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeAuthService implements IAuthService {
  private readonly _state$ = new BehaviorSubject<AuthState>(AuthState.Unauthenticated);
  private readonly _user$ = new BehaviorSubject<IUserAccount | null>(null);
  private readonly _err$ = new BehaviorSubject<IAuthError | null>(null);
  readonly authState$ = this._state$.asObservable();
  readonly currentUser$ = this._user$.asObservable();
  readonly lastError$ = this._err$.asObservable();

  setState(state: AuthState): void {
    this._state$.next(state);
  }

  async register(): Promise<void> { throw new Error('not used'); }
  async login(): Promise<void> { throw new Error('not used'); }
  async logout(): Promise<void> {}
  getCurrentUser(): IUserAccount | null { return null; }
  async getAccessToken(): Promise<string | null> { return null; }
  async restore(): Promise<void> {}
  async listDevices() { return []; }
  async revokeDevice(): Promise<void> {}
}

// Defaults to Unlocked so existing happy-path tests don't need to manually unlock.
// Tests that exercise the locked path call setMasterKeyState(Locked) explicitly.
class FakeMasterKeyService implements IMasterKeyService {
  private readonly _state$ = new BehaviorSubject<MasterKeyState>(MasterKeyState.Unlocked);
  readonly state$ = this._state$.asObservable();

  setMasterKeyState(state: MasterKeyState): void {
    this._state$.next(state);
  }

  async derive(): Promise<IMasterKey> { throw new Error('not used'); }
  lock(): void { this._state$.next(MasterKeyState.Locked); }
  getCurrent(): IMasterKey | null { return null; }
  getState(): MasterKeyState { return this._state$.getValue(); }
  async tryRestoreFromStorage(): Promise<boolean> { return false; }
  async clearPersistedKey(): Promise<void> {}
}

class FakeSyncService {
  enableCalls = 0;
  disableCalls = 0;
  stopRuntimeCalls = 0;
  async enable(): Promise<void> { this.enableCalls++; }
  async disable(): Promise<void> { this.disableCalls++; }
  async stopRuntime(): Promise<void> { this.stopRuntimeCalls++; }
}

class FakeConfigRepo {
  readonly store: Map<string, Map<string, unknown>> = new Map();

  async getField<T>(key: string, field: string): Promise<T | null> {
    return ((this.store.get(key)?.get(field) ?? null) as T | null);
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    this.store.get(key)!.set(field, value);
  }
}

interface ITestBed {
  auth: FakeAuthService;
  masterKey: FakeMasterKeyService;
  sync: FakeSyncService;
  config: ConfigService;
  configRepo: FakeConfigRepo;
  controller: AuthSyncBridgeController;
}

function createBed(opts: {
  autoEnableOnLogin?: boolean;
  persistedUserEnabled?: boolean;
} = {}): ITestBed {
  const auth = new FakeAuthService();
  const masterKey = new FakeMasterKeyService();
  const sync = new FakeSyncService();
  const config = new ConfigService();
  const configRepo = new FakeConfigRepo();
  if (opts.autoEnableOnLogin !== undefined) {
    config.setConfig(SYNC_PLUGIN_CONFIG_KEY, { autoEnableOnLogin: opts.autoEnableOnLogin });
  }
  if (opts.persistedUserEnabled !== undefined) {
    void configRepo.setField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD, opts.persistedUserEnabled);
  }
  const controller = new AuthSyncBridgeController(
    sync as never,
    masterKey,
    config,
    configRepo as never,
    new NoopLogService(),
    auth
  );
  return { auth, masterKey, sync, config, configRepo, controller };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// FakeAuthService starts at Unauthenticated, so the controller's first subscription
// fires stopRuntime() once. Assertions read the delta after each setState() call.
describe('AuthSyncBridgeController — sign-in fallback (no persisted intent)', () => {
  let bed: ITestBed;

  afterEach(() => {
    bed?.controller.dispose();
  });

  it('auto-enables on Authenticated when autoEnableOnLogin defaults to true', async () => {
    bed = createBed();
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);
    expect(bed.sync.disableCalls).toBe(0);
  });

  it('auto-enables on Authenticated when autoEnableOnLogin is explicitly true', async () => {
    bed = createBed({ autoEnableOnLogin: true });
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);
  });

  it('does NOT enable when autoEnableOnLogin=false and no persisted intent', async () => {
    bed = createBed({ autoEnableOnLogin: false });
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(0);
  });
});

describe('AuthSyncBridgeController — persisted user intent overrides flag', () => {
  let bed: ITestBed;

  afterEach(() => {
    bed?.controller.dispose();
  });

  // Regression for "重启后变成未启用": user explicit opt-in must auto-restore on the
  // next sign-in even if the plugin's autoEnableOnLogin flag is false.
  it('enables on Authenticated when persisted userEnabled=true (even with autoEnableOnLogin=false)', async () => {
    bed = createBed({ autoEnableOnLogin: false, persistedUserEnabled: true });
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);
  });

  it('does NOT enable on Authenticated when persisted userEnabled=false (overrides autoEnableOnLogin=true)', async () => {
    bed = createBed({ autoEnableOnLogin: true, persistedUserEnabled: false });
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(0);
  });
});

describe('AuthSyncBridgeController — sign-out preserves user intent', () => {
  let bed: ITestBed;

  afterEach(() => {
    bed?.controller.dispose();
  });

  // Sign-out must call stopRuntime (preserves userEnabled) rather than disable (flips
  // it to false and breaks the next sign-in auto-restore).
  it('Unauthenticated calls stopRuntime, never disable', async () => {
    bed = createBed({ persistedUserEnabled: true });
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    bed.auth.setState(AuthState.Unauthenticated);
    await flushAsync();
    expect(bed.sync.stopRuntimeCalls).toBeGreaterThanOrEqual(1);
    expect(bed.sync.disableCalls).toBe(0);
  });

  it('does not flip during Authenticating / Error transitions', async () => {
    bed = createBed({ autoEnableOnLogin: true });
    await flushAsync();
    const baselineEnable = bed.sync.enableCalls;
    const baselineStop = bed.sync.stopRuntimeCalls;
    bed.auth.setState(AuthState.Authenticating);
    bed.auth.setState(AuthState.Error);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(baselineEnable);
    expect(bed.sync.stopRuntimeCalls).toBe(baselineStop);
  });
});

describe('AuthSyncBridgeController — master key state coupling', () => {
  let bed: ITestBed;

  afterEach(() => {
    bed?.controller.dispose();
  });

  // Without this gate sync would start the pipeline against a locked master key, every
  // encrypt() would silently fail, and the UI would lie "synced". Regression for the bug
  // where mac displayed "已同步" while the cloud had no host data.
  it('does NOT enable while master key is locked, even if signed in with intent persisted', async () => {
    bed = createBed({ persistedUserEnabled: true });
    bed.masterKey.setMasterKeyState(MasterKeyState.Locked);
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(0);
  });

  it('enables automatically once the key flips from Locked to Unlocked', async () => {
    bed = createBed({ persistedUserEnabled: true });
    bed.masterKey.setMasterKeyState(MasterKeyState.Locked);
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(0);

    bed.masterKey.setMasterKeyState(MasterKeyState.Unlocked);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);
  });

  it('stops the runtime when the key locks while signed in (idle-lock scenario)', async () => {
    bed = createBed({ persistedUserEnabled: true });
    // happy path first
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);
    const baselineStop = bed.sync.stopRuntimeCalls;

    bed.masterKey.setMasterKeyState(MasterKeyState.Locked);
    await flushAsync();
    expect(bed.sync.stopRuntimeCalls).toBeGreaterThan(baselineStop);
    expect(bed.sync.disableCalls).toBe(0);   // userEnabled stays intact
  });

  it('re-enables after a lock → unlock cycle while staying Authenticated', async () => {
    bed = createBed({ persistedUserEnabled: true });
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);

    bed.masterKey.setMasterKeyState(MasterKeyState.Locked);
    await flushAsync();
    bed.masterKey.setMasterKeyState(MasterKeyState.Unlocked);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(2);
  });
});

describe('AuthSyncBridgeController — misc', () => {
  let bed: ITestBed;

  afterEach(() => {
    bed?.controller.dispose();
  });

  it('controller is a no-op when IAuthService is unbound (offline build)', async () => {
    const sync = new FakeSyncService();
    const masterKey = new FakeMasterKeyService();
    const config = new ConfigService();
    const configRepo = new FakeConfigRepo();
    const controller = new AuthSyncBridgeController(
      sync as never,
      masterKey,
      config,
      configRepo as never,
      new NoopLogService()
      // _authService omitted — simulates a build without cloudBaseUrl.
    );
    await flushAsync();
    expect(sync.enableCalls).toBe(0);
    expect(sync.stopRuntimeCalls).toBe(0);
    controller.dispose();
  });

  it('swallows enable() exceptions without crashing', async () => {
    bed = createBed({ autoEnableOnLogin: true });
    await flushAsync();
    const failingSync = bed.sync as unknown as { enable: () => Promise<void> };
    const errorSpy = vi.spyOn(failingSync, 'enable').mockRejectedValueOnce(new Error('boom'));
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(bed.sync.enableCalls).toBe(0);
    // Controller stays alive; next round trips through the real implementation.
    bed.auth.setState(AuthState.Unauthenticated);
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(bed.sync.enableCalls).toBe(1);
  });
});

// keep observable import referenced even if some tests don't bind it locally
void (BehaviorSubject as unknown as Observable<unknown>);
