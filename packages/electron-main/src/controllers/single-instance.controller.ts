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

import { Disposable, ILogService } from '@termlnk/core';
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

    this.disposeWithMe(
      fromEvent(app, 'second-instance').subscribe(() => this._focusMainWindow())
    );
  }

  private _focusMainWindow(): void {
    if (this._mainWindowId === null) {
      return;
    }
    void this._windowManagerService.focusWindow(this._mainWindowId).catch((err: any) => {
      this._logService.error(`[SingleInstanceController] Failed to focus main window: ${err.message}`);
    });
  }
}
