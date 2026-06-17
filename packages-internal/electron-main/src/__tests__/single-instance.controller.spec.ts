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
import type { ICreateWindowOptions, IWindowManagerService, IWindowState, WindowEvent as WindowEventType } from '@termlnk/electron';
import type { Observable } from 'rxjs';
import { EMPTY, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

// fromEvent(app, ...) needs a real EventEmitter; `app.dock` mimics macOS so the
// reveal path exercises dock.show() on darwin test runners.
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  const app = new EventEmitter();
  (app as unknown as { dock: { show: () => Promise<void> } }).dock = { show: () => Promise.resolve() };
  return { app };
});

const { app } = await import('electron');
const { SingleInstanceController } = await import('../controllers/single-instance.controller');

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeWindowManagerService implements IWindowManagerService {
  readonly windowEvent$: Observable<Map<number, WindowEventType>> = EMPTY;
  readonly windowState$: Observable<Map<number, IWindowState>> = EMPTY;
  readonly _windowCreated$ = new Subject<number>();
  readonly windowCreated$ = this._windowCreated$.asObservable();
  readonly windowClosed$: Observable<number> = EMPTY;

  focusWindow = vi.fn(async (_id: number): Promise<void> => {});

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
}

function createBed() {
  const windowManager = new FakeWindowManagerService();
  const controller = new SingleInstanceController(windowManager, new NoopLogService());
  return { windowManager, controller };
}

describe('SingleInstanceController', () => {
  let controller: { dispose: () => void } | undefined;

  afterEach(() => {
    controller?.dispose();
    controller = undefined;
    (app as unknown as { removeAllListeners: () => void }).removeAllListeners();
  });

  it('reveals the main window when macOS reopens the app (activate)', async () => {
    const bed = createBed();
    controller = bed.controller;
    bed.windowManager._windowCreated$.next(7);

    app.emit('activate');
    await vi.waitFor(() => expect(bed.windowManager.focusWindow).toHaveBeenCalledWith(7));
  });

  it('reveals the main window when a relaunch is folded into us (second-instance)', async () => {
    const bed = createBed();
    controller = bed.controller;
    bed.windowManager._windowCreated$.next(7);

    app.emit('second-instance');
    await vi.waitFor(() => expect(bed.windowManager.focusWindow).toHaveBeenCalledWith(7));
  });

  it('ignores activate before the main window exists', async () => {
    const bed = createBed();
    controller = bed.controller;

    app.emit('activate');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(bed.windowManager.focusWindow).not.toHaveBeenCalled();
  });
});
