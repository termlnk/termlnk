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

import type { IAuthError, IAuthService, IUserAccount } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { AuthState } from '@termlnk/auth';
import { ConfigService } from '@termlnk/core';
import { SYNC_PLUGIN_CONFIG_KEY } from '@termlnk/sync';
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

  async register(): Promise<IUserAccount> { throw new Error('not used'); }
  async login(): Promise<IUserAccount> { throw new Error('not used'); }
  async logout(): Promise<void> {}
  getCurrentUser(): IUserAccount | null { return null; }
  async getAccessToken(): Promise<string | null> { return null; }
  async restore(): Promise<void> {}
  async listDevices() { return []; }
  async revokeDevice(): Promise<void> {}
}

class FakeSyncService {
  enableCalls = 0;
  disableCalls = 0;
  async enable(): Promise<void> { this.enableCalls++; }
  async disable(): Promise<void> { this.disableCalls++; }
}

interface ITestBed {
  auth: FakeAuthService;
  sync: FakeSyncService;
  config: ConfigService;
  controller: AuthSyncBridgeController;
}

function createBed(autoEnableOnLogin: boolean | undefined): ITestBed {
  const auth = new FakeAuthService();
  const sync = new FakeSyncService();
  const config = new ConfigService();
  if (autoEnableOnLogin !== undefined) {
    config.setConfig(SYNC_PLUGIN_CONFIG_KEY, { autoEnableOnLogin });
  }
  const controller = new AuthSyncBridgeController(
    sync as never,
    auth,
    config,
    new NoopLogService()
  );
  return { auth, sync, config, controller };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * `FakeAuthService` uses `BehaviorSubject(Unauthenticated)`, so the controller's
 * first subscription receives an immediate `Unauthenticated` and fires
 * `disable()` once — this matches production "app startup" semantics. Every
 * test below implicitly accounts for that startup disable; assertions look at
 * the delta after each `setState` call to keep the noise out.
 */
describe('AuthSyncBridgeController — autoEnableOnLogin', () => {
  let bed: ITestBed;

  afterEach(() => {
    bed?.controller.dispose();
  });

  it('auto-enables on Authenticated when flag is missing (defaults to true)', async () => {
    bed = createBed(undefined);
    await flushAsync();
    const baselineDisable = bed.sync.disableCalls;
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);
    expect(bed.sync.disableCalls).toBe(baselineDisable);
  });

  it('auto-enables on Authenticated when flag is explicitly true', async () => {
    bed = createBed(true);
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1);
  });

  it('does NOT auto-enable when flag is explicitly false (manual mode)', async () => {
    bed = createBed(false);
    await flushAsync();
    const baselineDisable = bed.sync.disableCalls;
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(0);
    expect(bed.sync.disableCalls).toBe(baselineDisable); // no extra disables either
  });

  it('always disables on Unauthenticated regardless of flag', async () => {
    bed = createBed(false);
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    const baselineDisable = bed.sync.disableCalls;
    bed.auth.setState(AuthState.Unauthenticated);
    await flushAsync();
    expect(bed.sync.disableCalls).toBe(baselineDisable + 1);
  });

  it('does not flip during Authenticating / Error transitions', async () => {
    bed = createBed(true);
    await flushAsync();
    const baselineEnable = bed.sync.enableCalls;
    const baselineDisable = bed.sync.disableCalls;
    bed.auth.setState(AuthState.Authenticating);
    bed.auth.setState(AuthState.Error);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(baselineEnable);
    expect(bed.sync.disableCalls).toBe(baselineDisable);
  });

  it('re-reads config on each Authenticated transition (live config)', async () => {
    bed = createBed(false);
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(0); // first login under false

    bed.auth.setState(AuthState.Unauthenticated);
    await flushAsync();
    bed.config.setConfig(SYNC_PLUGIN_CONFIG_KEY, { autoEnableOnLogin: true });
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(bed.sync.enableCalls).toBe(1); // second login picks up new flag
  });

  it('controller is a no-op when IAuthService is unbound (offline build)', async () => {
    const sync = new FakeSyncService();
    const config = new ConfigService();
    const controller = new AuthSyncBridgeController(
      sync as never,
      null,
      config,
      new NoopLogService()
    );
    await flushAsync();
    expect(sync.enableCalls).toBe(0);
    expect(sync.disableCalls).toBe(0);
    controller.dispose();
  });

  it('swallows enable() exceptions without crashing', async () => {
    bed = createBed(true);
    await flushAsync();
    const failingSync = bed.sync as unknown as { enable: () => Promise<void> };
    const errorSpy = vi.spyOn(failingSync, 'enable').mockRejectedValueOnce(new Error('boom'));
    // 1st sign-in: spy rejects without invoking original → enableCalls stays 0.
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(bed.sync.enableCalls).toBe(0);
    // The exception is swallowed and the controller stays alive — second
    // sign-in falls through to the real path and bumps the counter.
    bed.auth.setState(AuthState.Unauthenticated);
    await flushAsync();
    bed.auth.setState(AuthState.Authenticated);
    await flushAsync();
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(bed.sync.enableCalls).toBe(1);
  });
});

// keep observable imports referenced even if some tests don't bind them locally
void (BehaviorSubject as unknown as Observable<unknown>);
