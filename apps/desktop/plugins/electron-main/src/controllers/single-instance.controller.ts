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

import { Disposable, ILogService, platform, Platform } from '@termlnk/core';
import { IWindowManagerService } from '@termlnk/electron';
import { app } from 'electron';
import { fromEvent, take } from 'rxjs';

export class SingleInstanceController extends Disposable {
  private _mainWindowId: number | null = null;

  constructor(
    @IWindowManagerService private readonly _windowManagerService: IWindowManagerService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    // Single-window app — the first BrowserWindow created is the main window.
    this.disposeWithMe(
      this._windowManagerService.windowCreated$.pipe(take(1)).subscribe((id) => {
        this._mainWindowId = id;
      })
    );

    // Both events ask us to surface the already-running instance's main window:
    // `second-instance` fires when the single-instance lock rejects a relaunch;
    // `activate` fires when macOS reopens the app (e.g. clicking the Dock icon).
    // Without the `activate` handler the Dock icon click is a no-op once the
    // window has been closed to tray, since close-to-tray also hides the Dock.
    this.disposeWithMe(
      fromEvent(app, 'second-instance').subscribe(() => this._revealMainWindow())
    );
    this.disposeWithMe(
      fromEvent(app, 'activate').subscribe(() => this._revealMainWindow())
    );
  }

  private _revealMainWindow(): void {
    const id = this._mainWindowId;
    if (id === null) {
      return;
    }
    void this._raiseMainWindow(id).catch((err: any) => {
      this._logService.error(`[SingleInstanceController] Failed to reveal main window: ${err.message}`);
    });
  }

  private async _raiseMainWindow(id: number): Promise<void> {
    // Close-to-tray drops the app into Accessory mode via app.dock.hide().
    // dock.show() runs an async setActivationPolicy(Regular); await it so the
    // app is back in Regular mode before focusWindow raises the hidden window.
    if (platform === Platform.Mac) {
      await app.dock?.show();
    }
    await this._windowManagerService.focusWindow(id);
  }
}
