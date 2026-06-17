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

import type { ISyncService } from '@termlnk/sync';
import { ILogService, Inject, Optional, RxDisposable } from '@termlnk/core';
import { IWindowManagerService, WindowEvent } from '@termlnk/electron';
import { ISyncService as ISyncServiceId, SYNC_TRIGGER_INTERVALS } from '@termlnk/sync';
import { debounceTime, filter, map, takeUntil } from 'rxjs';

/**
 * Window-focus → `SyncService.syncNow` bridge (**main process only**).
 * See cloud-sync-architecture.md §4.6, trigger row 4.
 *
 * When the user returns to a Termlnk window we push + pull once so the
 * state feels immediately fresh — the 5-min fallback poll guarantees
 * eventual consistency, but that's too slow for "I just clicked back to
 * the app".
 *
 * - **`debounceTime(pullDebounceMs)` (200 ms)** collapses bursts of focus
 *   events (multi-window switching, browser-drag-back-to-desktop) into a
 *   single `syncNow`.
 * - **`ISyncService` is `Quantity.OPTIONAL`** — without `cloudBaseUrl` the
 *   service is unbound and this controller no-ops, never blocking
 *   `ElectronMainPlugin` startup.
 * - **`syncNow` exceptions are swallowed.** Network failures and
 *   `master_key_locked` errors are already surfaced via
 *   `SyncService.lastError$` for the UI; we don't double-report.
 *
 * Out of scope here:
 * - We don't gate on `enabled$` — `SyncService.syncNow` already returns
 *   early when disabled (`!this._enabled$.getValue() → return`). Adding a
 *   second guard only makes the code more brittle.
 */
export class WindowFocusSyncController extends RxDisposable {
  constructor(
    @Inject(IWindowManagerService) windowManagerService: IWindowManagerService,
    @Optional(ISyncServiceId) private readonly _syncService: ISyncService | null = null,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();

    if (!this._syncService) {
      this._logService.log('[WindowFocusSyncController] ISyncService not bound; window-focus → sync trigger inactive');
      return;
    }

    windowManagerService.windowEvent$
      .pipe(
        // Any window getting focus counts as "user returned to the app"
        // — with multi-window setups the specific window does not matter.
        map((events) => Array.from(events.values())),
        filter((eventList) => eventList.includes(WindowEvent.Focus)),
        debounceTime(SYNC_TRIGGER_INTERVALS.pullDebounceMs),
        takeUntil(this.dispose$)
      )
      .subscribe(() => {
        void this._triggerSync();
      });
  }

  private async _triggerSync(): Promise<void> {
    try {
      await this._syncService!.syncNow();
    } catch (err) {
      this._logService.warn('[WindowFocusSyncController] syncNow on focus failed:', err);
    }
  }
}
