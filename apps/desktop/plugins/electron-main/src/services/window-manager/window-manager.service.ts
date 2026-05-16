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

import type { IDisposable } from '@termlnk/core';
import type { ICreateWindowOptions, IWindowManagerService, IWindowState } from '@termlnk/electron';
import type { Observable } from 'rxjs';
import { ILogService, merge, Platform, platform, RxDisposable, toDisposable, URI } from '@termlnk/core';
import { WindowEvent } from '@termlnk/electron';
import { app, BrowserWindow } from 'electron';
import { filter, map, Subject } from 'rxjs';
import { DEFAULT_WINDOW_OPTIONS } from '../../config/config';

export class WindowManagerService extends RxDisposable implements IWindowManagerService {
  private readonly _windowMap: Map<number, BrowserWindow> = new Map();
  private readonly _windowDisposable = new Map<number, IDisposable>();

  private readonly _windowEvent$ = new Subject<Map<number, WindowEvent>>();
  readonly windowEvent$ = this._windowEvent$.asObservable();

  private readonly _windowState$ = new Subject<Map<number, IWindowState>>();
  readonly windowState$ = this._windowState$.asObservable();

  private readonly _windowCreated$ = new Subject<number>();
  readonly windowCreated$ = this._windowCreated$.asObservable();

  private readonly _windowClosed$ = new Subject<number>();
  readonly windowClosed$ = this._windowClosed$.asObservable();

  private _closeInterceptor: ((windowId: number) => boolean) | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._init();
  }

  private _init() {
    this.disposeWithMe(this._listenAppEvent());
  }

  override dispose() {
    super.dispose();
    this._closeInterceptor = null;
    this._windowDisposable.forEach((d) => d?.dispose());
    this._windowDisposable.clear();
    this._windowMap.clear();
    this._windowState$.complete();
    this._windowEvent$.complete();
    this._windowCreated$.complete();
    this._windowClosed$.complete();
  }

  setCloseInterceptor(interceptor: (windowId: number) => boolean): IDisposable {
    this._closeInterceptor = interceptor;
    return toDisposable(() => {
      if (this._closeInterceptor === interceptor) {
        this._closeInterceptor = null;
      }
    });
  }

  async getCurrentWindowId(): Promise<number> {
    throw new Error('getCurrentWindowId should be called through RPC context');
  }

  async createWindow(url: string, options?: ICreateWindowOptions): Promise<number> {
    const window = new BrowserWindow(merge(DEFAULT_WINDOW_OPTIONS, this._getWindowOptions(), options));
    const id = window.id;
    await this._loadContent(window, url);
    return id;
  }

  getWindows(): BrowserWindow[] {
    return [...this._windowMap.values()];
  }

  getWindow(id: number): BrowserWindow | undefined {
    return this._windowMap.get(id);
  }

  async hasWindow(id: number): Promise<boolean> {
    return this._windowMap.has(id);
  }

  async showWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.show();
  }

  async hideWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.hide();
  }

  async focusWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
  }

  async maximizeWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    if (window.isMaximized()) {
      return;
    }
    window.maximize();
  }

  async toggleMaximizeWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }

  async toggleFullScreen(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.setFullScreen(!window.isFullScreen());
  }

  async minimizeWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    if (window.isMinimized()) {
      return;
    }
    window.minimize();
  }

  async closeWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.close();
  }

  async destroyWindow(id: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.destroy();
  }

  async setAlwaysOnTop(id: number, flag: boolean): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.setAlwaysOnTop(flag);
  }

  async setOpacity(id: number, opacity: number): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }

    window.setOpacity(Math.min(1, Math.max(0, opacity)));
  }

  async setVibrancy(id: number, type: string | null): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.setVibrancy(type as any);
  }

  async setBackgroundMaterial(id: number, material: string): Promise<void> {
    const window = this._windowMap.get(id);
    if (!window) {
      return;
    }
    window.setBackgroundMaterial(material as any);
  }

  async getWindowState(id: number): Promise<IWindowState> {
    if (!this._windowMap.has(id)) {
      throw new Error(`window ${id} not found`);
    }
    return this._getWindowState(id);
  }

  getWindowState$(id: number): Observable<IWindowState> {
    return this._windowState$.pipe(
      map((m) => m.get(id)),
      filter((state): state is IWindowState => state !== undefined)
    );
  }

  onWindowEvent$(id: number, event?: WindowEvent): Observable<WindowEvent> {
    return this._windowEvent$.pipe(
      map((m) => m.get(id)),
      filter((e): e is WindowEvent => {
        if (event) {
          return e !== undefined && e === event;
        }
        return e !== undefined;
      })
    );
  }

  private _listenAppEvent() {
    const appEvents: Partial<Record<WindowEvent, Function>> = {
      [WindowEvent.Created]: (_event: Event, browserWindow: BrowserWindow) => {
        const id = browserWindow.id;
        this._windowMap.set(id, browserWindow);
        this._windowDisposable.set(id, this._listenWindowEvent(browserWindow));
        this._windowEvent$.next(new Map([[id, WindowEvent.Created]]));
        this._windowCreated$.next(id);

        if (platform === Platform.Mac) {
          browserWindow.setWindowButtonVisibility(false);
        }
      },
    };
    for (const [event, handler] of Object.entries(appEvents)) {
      app.on(event as any, handler as any);
    }

    return toDisposable(() => {
      for (const [event, handler] of Object.entries(appEvents)) {
        app.off(event as any, handler as any);
      }
    });
  }

  private _listenWindowEvent(window: BrowserWindow): IDisposable {
    const id = window.id;

    const handleState = () => {
      const state = this._getWindowState(id);
      this._windowState$.next(new Map([[id, state]]));
    };

    const events: Partial<Record<WindowEvent, Function>> = {
      [WindowEvent.Close]: (event: Event) => {
        if (this._closeInterceptor?.(id)) {
          event.preventDefault();
          return;
        }
        this._windowDisposable.get(id)?.dispose();
        this._windowEvent$.next(new Map([[id, WindowEvent.Close]]));
      },
      [WindowEvent.Closed]: () => {
        this._windowMap.delete(id);
        this._windowEvent$.next(new Map([[id, WindowEvent.Closed]]));
        this._windowClosed$.next(id);
      },
      [WindowEvent.Focus]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Focus]]));
      },
      [WindowEvent.Blur]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Blur]]));
      },
      [WindowEvent.Show]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Show]]));
      },
      [WindowEvent.Hide]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Hide]]));
      },
      [WindowEvent.ReadyToShow]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.ReadyToShow]]));
      },
      [WindowEvent.EnterFullScreen]: () => {
        window.setWindowButtonVisibility(true);
        this._windowEvent$.next(new Map([[id, WindowEvent.EnterFullScreen]]));
        handleState();
      },
      [WindowEvent.LeaveFullScreen]: () => {
        window.setWindowButtonVisibility(false);
        this._windowEvent$.next(new Map([[id, WindowEvent.LeaveFullScreen]]));
        handleState();
      },
      [WindowEvent.Maximize]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Maximize]]));
        handleState();
      },
      [WindowEvent.Unmaximize]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Unmaximize]]));
        handleState();
      },
      [WindowEvent.Minimize]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Minimize]]));
        handleState();
      },
      [WindowEvent.Restore]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Restore]]));
        handleState();
      },
      [WindowEvent.Move]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Move]]));
        handleState();
      },
      [WindowEvent.Moved]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Moved]]));
      },
      [WindowEvent.WillMove]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.WillMove]]));
      },
      [WindowEvent.Resize]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Resize]]));
        handleState();
      },
      [WindowEvent.Resized]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.Resized]]));
      },
      [WindowEvent.AlwaysOnTopChanged]: () => {
        this._windowEvent$.next(new Map([[id, WindowEvent.AlwaysOnTopChanged]]));
        handleState();
      },
    };
    for (const [event, handler] of Object.entries(events)) {
      window.on(event as any, handler as any);
    }

    return toDisposable(() => {
      for (const [event, handler] of Object.entries(events)) {
        window.off(event as any, handler as any);
      }
    });
  }

  private _getWindowState(id: number): IWindowState {
    const window = this._windowMap.get(id)!;
    return {
      id,
      fullScreen: window.isFullScreen(),
      focusable: window.isFocusable(),
      minimizable: window.isMinimizable(),
      maximizable: window.isMaximizable(),
      isMaximized: window.isMaximized(),
      alwaysOnTop: window.isAlwaysOnTop(),
      bounds: window.getBounds(),
    };
  }

  /**
   * Route to Electron's loadFile or loadURL based on the input type.
   *
   * URI.parse interprets the drive letter of a Windows absolute path
   * (e.g. "C:/foo") as a URI scheme.  We detect this before parsing
   * so that file paths are always handled by loadFile.
   */
  private async _loadContent(window: BrowserWindow, url: string): Promise<void> {
    // Windows absolute path — drive letter + colon + separator
    if (/^[a-zA-Z]:[/\\]/.test(url)) {
      await window.loadFile(url);
      return;
    }

    const parsed = URI.parse(url);
    if (parsed.scheme === 'file') {
      await window.loadFile(parsed.fsPath);
    } else if (!parsed.scheme) {
      // Unix absolute path without scheme (e.g. /usr/local/.../index.html)
      await window.loadFile(url);
    } else {
      await window.loadURL(url);
    }
  }

  private _getWindowOptions(): ICreateWindowOptions {
    switch (platform) {
      case Platform.Windows:
        return {
          frame: false,
          thickFrame: true,
          backgroundColor: '#101216',
        };
      case Platform.Linux:
        return {
          frame: false,
          // Linux still relies on native window transparency plus a compositor
          // to reveal the desktop through CSS transparent backgrounds.
          transparent: true,
          backgroundColor: '#00000000',
        };
      case Platform.Mac:
        return {
          titleBarStyle: 'hiddenInset',
          vibrancy: 'sidebar',
          visualEffectState: 'followWindow',
          transparent: true,
        };
      default:
        return {
          frame: false,
        };
    }
  }
}
