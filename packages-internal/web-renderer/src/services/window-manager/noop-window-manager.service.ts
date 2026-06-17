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

import type { ICreateWindowOptions, IWindowManagerService, IWindowState, WindowEvent } from '@termlnk/electron';
import type { Observable } from 'rxjs';
import { EMPTY, NEVER, of } from 'rxjs';

const VIRTUAL_WINDOW_ID = 1;
const DEFAULT_WINDOW_STATE: IWindowState = {
  id: VIRTUAL_WINDOW_ID,
  focusable: true,
  fullScreen: false,
  minimizable: false,
  maximizable: false,
  isMaximized: false,
  alwaysOnTop: false,
  // Browser viewport: derive from window.innerWidth/Height when present;
  // fall back to a sensible default for unit-test / SSR contexts.
  bounds: typeof window !== 'undefined'
    ? { x: 0, y: 0, width: window.innerWidth || 1280, height: window.innerHeight || 800 }
    : { x: 0, y: 0, width: 1280, height: 800 },
};

// Browser-side IWindowManagerService stub. The tab IS the window; expose a single virtual
// window so UI consumers (`getCurrentWindowId`, title-bar buttons) still resolve, but
// every mutation is a no-op.
export class NoopWindowManagerService implements IWindowManagerService {
  readonly windowState$: Observable<Map<number, IWindowState>> = of(
    new Map([[VIRTUAL_WINDOW_ID, DEFAULT_WINDOW_STATE]])
  );

  readonly windowEvent$: Observable<Map<number, WindowEvent>> = NEVER;
  readonly windowCreated$: Observable<number> = EMPTY;
  readonly windowClosed$: Observable<number> = EMPTY;

  async getCurrentWindowId(): Promise<number> {
    return VIRTUAL_WINDOW_ID;
  }

  async createWindow(_url: string, _options?: ICreateWindowOptions): Promise<number> {
    return VIRTUAL_WINDOW_ID;
  }

  async hasWindow(id: number): Promise<boolean> {
    return id === VIRTUAL_WINDOW_ID;
  }

  async showWindow(_id: number): Promise<void> {}
  async hideWindow(_id: number): Promise<void> {}
  async focusWindow(_id: number): Promise<void> {}
  async maximizeWindow(_id: number): Promise<void> {}
  async toggleMaximizeWindow(_id: number): Promise<void> {}
  async toggleFullScreen(_id: number): Promise<void> {}
  async minimizeWindow(_id: number): Promise<void> {}
  async closeWindow(_id: number): Promise<void> {}
  async destroyWindow(_id: number): Promise<void> {}
  async setAlwaysOnTop(_id: number, _flag: boolean): Promise<void> {}
  async setOpacity(_id: number, _opacity: number): Promise<void> {}
  async setVibrancy(_id: number, _type: string | null): Promise<void> {}
  async setBackgroundMaterial(_id: number, _material: string): Promise<void> {}

  async getWindowState(_id: number): Promise<IWindowState> {
    return DEFAULT_WINDOW_STATE;
  }

  getWindowState$(_id: number): Observable<IWindowState> {
    return of(DEFAULT_WINDOW_STATE);
  }

  onWindowEvent$(_id: number, _event?: WindowEvent): Observable<WindowEvent> {
    return NEVER;
  }
}
