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

import type { IIdleProbe, IMasterKey, IMasterKeyService } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { AUTH_PLUGIN_CONFIG_KEY, MasterKeyState } from '@termlnk/auth';
import { ConfigService } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleLockController } from '../controllers/idle-lock.controller';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeMasterKeyService implements IMasterKeyService {
  private readonly _state$ = new BehaviorSubject<MasterKeyState>(MasterKeyState.Locked);
  readonly state$: Observable<MasterKeyState> = this._state$.asObservable();
  lockCalls = 0;

  setState(state: MasterKeyState): void {
    this._state$.next(state);
  }

  async derive(): Promise<IMasterKey> {
    throw new Error('not used in these tests');
  }

  lock(): void {
    this.lockCalls++;
    this._state$.next(MasterKeyState.Locked);
  }

  getCurrent(): IMasterKey | null {
    return null;
  }

  getState(): MasterKeyState {
    return this._state$.getValue();
  }
}

class StubIdleProbe implements IIdleProbe {
  seconds = 0;
  errorOnce = false;
  callCount = 0;

  getIdleSeconds(): number {
    this.callCount++;
    if (this.errorOnce) {
      this.errorOnce = false;
      throw new Error('boom');
    }
    return this.seconds;
  }
}

interface ITestBed {
  master: FakeMasterKeyService;
  probe: StubIdleProbe;
  config: ConfigService;
  controller: IdleLockController;
}

function createBed(autoLockMinutes: number): ITestBed {
  const master = new FakeMasterKeyService();
  const probe = new StubIdleProbe();
  const config = new ConfigService();
  config.setConfig(AUTH_PLUGIN_CONFIG_KEY, { autoLockIdleMinutes: autoLockMinutes });
  const controller = new IdleLockController(master, probe, config, new NoopLogService());
  return { master, probe, config, controller };
}

describe('IdleLockController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not poll while master key is Locked', () => {
    const bed = createBed(5);
    bed.probe.seconds = 9999;
    vi.advanceTimersByTime(60_000);
    expect(bed.probe.callCount).toBe(0);
    expect(bed.master.lockCalls).toBe(0);
    bed.controller.dispose();
  });

  it('polls every 15s after master key Unlocks', () => {
    const bed = createBed(5);
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.probe.callCount).toBe(1);
    vi.advanceTimersByTime(15_000);
    expect(bed.probe.callCount).toBe(2);
    bed.controller.dispose();
  });

  it('does not lock when idle is below threshold', () => {
    const bed = createBed(5); // 5 minutes = 300 seconds
    bed.probe.seconds = 200;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.master.lockCalls).toBe(0);
    bed.controller.dispose();
  });

  it('locks when idle reaches threshold', () => {
    const bed = createBed(5);
    bed.probe.seconds = 300;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.master.lockCalls).toBe(1);
    bed.controller.dispose();
  });

  it('locks when idle exceeds threshold', () => {
    const bed = createBed(5);
    bed.probe.seconds = 999;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.master.lockCalls).toBe(1);
    bed.controller.dispose();
  });

  it('autoLockIdleMinutes=0 disables locking entirely (idle has no effect)', () => {
    const bed = createBed(0);
    bed.probe.seconds = 9999;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.master.lockCalls).toBe(0);
    bed.controller.dispose();
  });

  it('stops polling after Unlocked → Locked (lock from elsewhere)', () => {
    const bed = createBed(5);
    bed.probe.seconds = 0;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.probe.callCount).toBe(1);

    bed.master.setState(MasterKeyState.Locked); // simulated logout
    vi.advanceTimersByTime(60_000);
    expect(bed.probe.callCount).toBe(1); // no further calls
    bed.controller.dispose();
  });

  it('resumes polling on re-Unlock (login → idle-lock → re-login)', () => {
    const bed = createBed(5);
    bed.probe.seconds = 0;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.probe.callCount).toBe(1);

    bed.master.setState(MasterKeyState.Locked);
    vi.advanceTimersByTime(60_000);
    expect(bed.probe.callCount).toBe(1);

    bed.master.setState(MasterKeyState.Unlocked); // user signs back in
    vi.advanceTimersByTime(15_000);
    expect(bed.probe.callCount).toBe(2);
    bed.controller.dispose();
  });

  it('survives idle-probe exceptions without locking', () => {
    const bed = createBed(5);
    bed.probe.errorOnce = true;
    bed.probe.seconds = 9999;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000); // first tick throws → no lock
    expect(bed.master.lockCalls).toBe(0);
    vi.advanceTimersByTime(15_000); // second tick reads 9999 → lock
    expect(bed.master.lockCalls).toBe(1);
    bed.controller.dispose();
  });

  it('picks up live config changes on next tick', () => {
    const bed = createBed(0); // initial: disabled
    bed.probe.seconds = 9999;
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    expect(bed.master.lockCalls).toBe(0);

    bed.config.setConfig(AUTH_PLUGIN_CONFIG_KEY, { autoLockIdleMinutes: 1 });
    vi.advanceTimersByTime(15_000);
    expect(bed.master.lockCalls).toBe(1);
    bed.controller.dispose();
  });

  it('dispose stops polling and is idempotent', () => {
    const bed = createBed(5);
    bed.master.setState(MasterKeyState.Unlocked);
    vi.advanceTimersByTime(15_000);
    bed.controller.dispose();
    bed.probe.seconds = 9999;
    vi.advanceTimersByTime(60_000);
    expect(bed.master.lockCalls).toBe(0); // probe.seconds was 0 during the only polled tick
    expect(() => bed.controller.dispose()).not.toThrow();
  });
});
