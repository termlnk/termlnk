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

import { createIPCHandler } from '@janwirth/electron-trpc-link/main';
import { Disposable, Inject, Injector } from '@termlnk/core';
import { IWindowManagerService } from '@termlnk/electron';
import { appRouter, mergeRouters, router } from '@termlnk/rpc-server';
import { BrowserWindow } from 'electron';
import { updaterRouter } from '../trpc/routes/updater';
import { windowRouter } from '../trpc/routes/window';

export function createDesktopAppRouter() {
  return mergeRouters(
    appRouter,
    router({ window: windowRouter, updater: updaterRouter })
  );
}
export type DesktopAppRouter = ReturnType<typeof createDesktopAppRouter>;

export class RPCController extends Disposable {
  private _ipcHandler: ReturnType<typeof createIPCHandler>;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IWindowManagerService private readonly _windowManagerService: IWindowManagerService
  ) {
    super();

    this._init();
  }

  private _init() {
    this.disposeWithMe(
      this._windowManagerService.windowCreated$.subscribe((windowId) => {
        const window = BrowserWindow.fromId(windowId);
        if (window) {
          this._ipcHandler.attachWindow(window);
        }
      })
    );

    this.disposeWithMe(
      this._windowManagerService.windowClosed$.subscribe((windowId) => {
        const window = BrowserWindow.fromId(windowId);
        if (window) {
          this._ipcHandler.detachWindow(window);
        }
      })
    );

    this._ipcHandler = createIPCHandler({
      router: createDesktopAppRouter(),
      windows: BrowserWindow.getAllWindows(),
      createContext: async ({ event }) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        return {
          injector: this._injector,
          windowId: window?.id,
        };
      },
    });
  }
}
