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

import type { IDisposable, ILogService, LogLevel } from '@termlnk/core';
import type { ICreateWindowOptions, IWindowManagerService, IWindowState, WindowEvent as WindowEventType } from '@termlnk/electron';
import type { IResourceSynchroniser, ISyncError, ISyncService, ISyncStats, SyncState } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { WindowEvent } from '@termlnk/electron';
import { BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WindowFocusSyncController } from '../controllers/window-focus-sync.controller';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeWindowManagerService implements IWindowManagerService {
  readonly _windowEvent$ = new Subject<Map<number, WindowEventType>>();
  readonly windowEvent$ = this._windowEvent$.asObservable();
  readonly windowState$: Observable<Map<number, IWindowState>> = EMPTY;
  readonly windowCreated$: Observable<number> = EMPTY;
  readonly windowClosed$: Observable<number> = EMPTY;

  emit(id: number, event: WindowEventType): void {
    this._windowEvent$.next(new Map([[id, event]]));
  }

  async getCurrentWindowId(): Promise<number> { return 1; }
  async createWindow(_url: string, _options?: ICreateWindowOptions): Promise<number> { return 1; }
  async hasWindow(_id: number): Promise<boolean> { return true; }
  async showWindow(_id: number): Promise<void> {}
  async hideWindow(_id: number): Promise<void> {}
  async maximizeWindow(_id: number): Promise<void> {}
  async minimizeWindow(_id: number): Promise<void> {}
  async closeWindow(_id: number): Promise<void> {}
  async destroyWindow(_id: number): Promise<void> {}
  async setAlwaysOnTop(_id: number, _flag: boolean): Promise<void> {}
  async toggleMaximizeWindow(_id: number): Promise<void> {}
  async toggleFullScreen(_id: number): Promise<void> {}
  async setOpacity(_id: number, _opacity: number): Promise<void> {}
  async setVibrancy(_id: number, _type: string | null): Promise<void> {}
  async setBackgroundMaterial(_id: number, _material: string): Promise<void> {}
  async getWindowState(_id: number): Promise<IWindowState> {
    throw new Error('not used');
  }

  getWindowState$(_id: number): Observable<IWindowState> { return EMPTY; }
  onWindowEvent$(_id: number, _event?: WindowEventType): Observable<WindowEventType> { return EMPTY; }
  async focusWindow(_id: number): Promise<void> {}
}

class FakeSyncService implements ISyncService {
  readonly state$ = new BehaviorSubject<SyncState>('disabled' as SyncState).asObservable();
  readonly stats$ = new BehaviorSubject<ISyncStats>({ pendingMutations: 0, lastSyncedAt: null, lastPushedAt: null, perResource: {} as never }).asObservable();
  readonly lastError$ = new BehaviorSubject<ISyncError | null>(null).asObservable();
  readonly enabled$ = new BehaviorSubject<boolean>(false).asObservable();
  syncNowCalls = 0;
  syncNowShouldThrow = false;

  async enable(): Promise<void> {}
  async disable(): Promise<void> {}
  async syncNow(): Promise<void> {
    this.syncNowCalls++;
    if (this.syncNowShouldThrow) {
      throw new Error('boom');
    }
  }

  async forceFullResync(): Promise<void> {}

  register(_synchroniser: IResourceSynchroniser): IDisposable {
    return { dispose: () => {} };
  }

  async stopRuntime(): Promise<void> {}
}

interface ITestBed {
  windowManager: FakeWindowManagerService;
  syncService: FakeSyncService | null;
  controller: WindowFocusSyncController;
}

function createBed(opts: { withSync: boolean }): ITestBed {
  const windowManager = new FakeWindowManagerService();
  const syncService = opts.withSync ? new FakeSyncService() : null;
  const controller = new WindowFocusSyncController(
    windowManager,
    syncService,
    new NoopLogService()
  );
  return { windowManager, syncService, controller };
}

describe('WindowFocusSyncController', () => {
  let bed: ITestBed;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    bed?.controller.dispose();
  });

  it('triggers syncNow once on focus event after debounce window', async () => {
    bed = createBed({ withSync: true });
    bed.windowManager.emit(1, WindowEvent.Focus);
    expect(bed.syncService!.syncNowCalls).toBe(0); // not yet — within debounce
    await vi.advanceTimersByTimeAsync(200);
    expect(bed.syncService!.syncNowCalls).toBe(1);
  });

  it('debounces multiple rapid focus events into a single syncNow', async () => {
    bed = createBed({ withSync: true });
    bed.windowManager.emit(1, WindowEvent.Focus);
    bed.windowManager.emit(2, WindowEvent.Focus);
    bed.windowManager.emit(1, WindowEvent.Focus);
    await vi.advanceTimersByTimeAsync(200);
    expect(bed.syncService!.syncNowCalls).toBe(1);
  });

  it('does not trigger syncNow on non-Focus window events', async () => {
    bed = createBed({ withSync: true });
    bed.windowManager.emit(1, WindowEvent.Blur);
    bed.windowManager.emit(1, WindowEvent.Hide);
    bed.windowManager.emit(1, WindowEvent.Resize);
    bed.windowManager.emit(1, WindowEvent.Maximize);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(bed.syncService!.syncNowCalls).toBe(0);
  });

  it('triggers again on a Focus event after a separate idle period', async () => {
    bed = createBed({ withSync: true });
    bed.windowManager.emit(1, WindowEvent.Focus);
    await vi.advanceTimersByTimeAsync(200);
    expect(bed.syncService!.syncNowCalls).toBe(1);

    bed.windowManager.emit(1, WindowEvent.Blur);
    await vi.advanceTimersByTimeAsync(1_000);

    bed.windowManager.emit(1, WindowEvent.Focus);
    await vi.advanceTimersByTimeAsync(200);
    expect(bed.syncService!.syncNowCalls).toBe(2);
  });

  it('is a no-op when ISyncService is unbound (offline build)', async () => {
    bed = createBed({ withSync: false });
    bed.windowManager.emit(1, WindowEvent.Focus);
    await vi.advanceTimersByTimeAsync(1_000);
    // no syncService → no observable side-effect to assert; we just ensure no crash
    expect(() => bed.controller.dispose()).not.toThrow();
  });

  it('survives syncNow exceptions without unsubscribing the focus listener', async () => {
    bed = createBed({ withSync: true });
    bed.syncService!.syncNowShouldThrow = true;
    bed.windowManager.emit(1, WindowEvent.Focus);
    await vi.advanceTimersByTimeAsync(200);
    expect(bed.syncService!.syncNowCalls).toBe(1);

    bed.syncService!.syncNowShouldThrow = false;
    bed.windowManager.emit(1, WindowEvent.Focus);
    await vi.advanceTimersByTimeAsync(200);
    expect(bed.syncService!.syncNowCalls).toBe(2);
  });
});
