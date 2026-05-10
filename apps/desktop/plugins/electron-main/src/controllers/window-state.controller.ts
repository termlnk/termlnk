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

import type { Rectangle } from 'electron';
import type { IMainWindowState } from '../services/window-state/type';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { IWindowManagerService, WindowEvent } from '@termlnk/electron';
import { BrowserWindow, screen } from 'electron';
import { debounceTime } from 'rxjs';
import { MAIN_WINDOW_STATE_FIELD, normalizeMainWindowState } from '../services/window-state/type';
import { ELECTRON_MAIN_PLUGIN_CONFIG_KEY } from './config.schema';

// Debounce persistence so a resize drag emits a single DB write on settle.
const PERSIST_DEBOUNCE_MS = 500;

// A window must overlap at least this many px with a display's work area
// to be considered reachable; otherwise the saved bounds are discarded.
const MIN_VISIBLE_OVERLAP = 100;

export class WindowStateController extends Disposable {
  private readonly _ready$: Promise<IMainWindowState>;

  constructor(
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @IWindowManagerService private readonly _windowManagerService: IWindowManagerService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._ready$ = this._loadPersistedState();
  }

  async getPersistedState(): Promise<IMainWindowState> {
    const state = await this._ready$;
    if (state.bounds.x === undefined || state.bounds.y === undefined) {
      return state;
    }
    if (this._isBoundsVisible(state.bounds as Rectangle)) {
      return state;
    }
    this._logService.log('[WindowStateController] Saved bounds no longer visible, centering window');
    return {
      bounds: { width: state.bounds.width, height: state.bounds.height },
      isMaximized: state.isMaximized,
      isFullScreen: state.isFullScreen,
    };
  }

  trackMainWindow(windowId: number): void {
    this.disposeWithMe(
      this._windowManagerService.getWindowState$(windowId).pipe(
        debounceTime(PERSIST_DEBOUNCE_MS)
      ).subscribe(() => {
        void this._persistWindowState(windowId);
      })
    );

    // Debounce may swallow the final move/resize if the user quits fast;
    // flush once more when the window begins closing.
    this.disposeWithMe(
      this._windowManagerService.onWindowEvent$(windowId, WindowEvent.Close).subscribe(() => {
        void this._persistWindowState(windowId);
      })
    );
  }

  private async _loadPersistedState(): Promise<IMainWindowState> {
    try {
      const stored = await this._configRepository.getField<Partial<IMainWindowState>>(
        ELECTRON_MAIN_PLUGIN_CONFIG_KEY,
        MAIN_WINDOW_STATE_FIELD
      );
      return normalizeMainWindowState(stored);
    } catch (err: any) {
      this._logService.error(`[WindowStateController] Failed to load window state: ${err.message}`);
      return normalizeMainWindowState(null);
    }
  }

  private async _persistWindowState(windowId: number): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window || window.isDestroyed()) {
      return;
    }
    // getNormalBounds reports the unmaximized/unfullscreen rectangle,
    // so we never overwrite the restorable size with screen-sized values.
    const bounds = window.getNormalBounds();
    const state: IMainWindowState = {
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
    };
    try {
      await this._configRepository.setField(ELECTRON_MAIN_PLUGIN_CONFIG_KEY, MAIN_WINDOW_STATE_FIELD, state);
    } catch (err: any) {
      this._logService.error(`[WindowStateController] Failed to persist window state: ${err.message}`);
    }
  }

  private _isBoundsVisible(bounds: Rectangle): boolean {
    return screen.getAllDisplays().some((display) => {
      const wa = display.workArea;
      return bounds.x + bounds.width > wa.x + MIN_VISIBLE_OVERLAP
        && bounds.x < wa.x + wa.width - MIN_VISIBLE_OVERLAP
        && bounds.y + bounds.height > wa.y + MIN_VISIBLE_OVERLAP
        && bounds.y < wa.y + wa.height - MIN_VISIBLE_OVERLAP;
    });
  }
}
