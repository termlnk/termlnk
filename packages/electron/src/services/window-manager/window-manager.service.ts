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

import type { Observable } from 'rxjs';
import type { ICreateWindowOptions, IWindowState, WindowEvent } from './type';
import { createIdentifier } from '@termlnk/core';

export interface IWindowManagerService {
  readonly windowState$: Observable<Map<number, IWindowState>>;
  readonly windowEvent$: Observable<Map<number, WindowEvent>>;
  readonly windowCreated$: Observable<number>;
  readonly windowClosed$: Observable<number>;

  getCurrentWindowId(): Promise<number>;
  createWindow(url: string, options?: ICreateWindowOptions): Promise<number>;
  hasWindow(id: number): Promise<boolean>;
  showWindow(id: number): Promise<void>;
  hideWindow(id: number): Promise<void>;
  focusWindow(id: number): Promise<void>;
  maximizeWindow(id: number): Promise<void>;
  toggleMaximizeWindow(id: number): Promise<void>;
  toggleFullScreen(id: number): Promise<void>;
  minimizeWindow(id: number): Promise<void>;
  closeWindow(id: number): Promise<void>;
  destroyWindow(id: number): Promise<void>;
  setAlwaysOnTop(id: number, flag: boolean): Promise<void>;
  setOpacity(id: number, opacity: number): Promise<void>;
  setVibrancy(id: number, type: string | null): Promise<void>;
  setBackgroundMaterial(id: number, material: string): Promise<void>;
  getWindowState(id: number): Promise<IWindowState>;
  getWindowState$(id: number): Observable<IWindowState>;
  onWindowEvent$(id: number, event?: WindowEvent): Observable<WindowEvent>;
}

export const WindowManagerServiceName = 'electron.window-manager-service';
export const IWindowManagerService = createIdentifier<IWindowManagerService>(WindowManagerServiceName);
