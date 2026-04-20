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

import type { BrowserWindowConstructorOptions, Rectangle } from 'electron';

export interface ICreateWindowOptions extends BrowserWindowConstructorOptions {
}

export interface IWindowState {
  id: number;
  focusable: boolean;
  fullScreen: boolean;
  minimizable: boolean;
  maximizable: boolean;
  isMaximized: boolean;
  alwaysOnTop: boolean;
  bounds: Rectangle;
}

export enum WindowEvent {
  Created = 'browser-window-created',

  Close = 'close',
  Closed = 'closed',
  Focus = 'focus',
  Blur = 'blur',
  ReadyToShow = 'ready-to-show',
  Show = 'show',
  Hide = 'hide',
  EnterFullScreen = 'enter-full-screen',
  LeaveFullScreen = 'leave-full-screen',
  Maximize = 'maximize',
  Unmaximize = 'unmaximize',
  Minimize = 'minimize',
  Restore = 'restore',
  Move = 'move',
  Moved = 'moved',
  WillMove = 'will-move',
  Resize = 'resize',
  Resized = 'resized',
  AlwaysOnTopChanged = 'always-on-top-changed',
}
