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
 * 窗口聚焦 → SyncService.syncNow 触发桥（**仅主进程**，cloud-sync-architecture.md §4.6 触发策略表第 4 行）。
 *
 * 用户从后台返回前台窗口时立即 push + pull 一次，给"切回 Termlnk 看到的就是最新状态"
 * 的体感——5 min 兜底轮询保证最终一致，但用户可能等不了那么久。
 *
 * 设计要点：
 * - **debounce pullDebounceMs (200 ms)**：多窗口快速切焦点 / 浏览器拖拽返回桌面这种连发
 *   focus 事件被合并成一次 syncNow，不会刷云端
 * - **ISyncService Quantity.OPTIONAL**：sync 未配置（无 cloudBaseUrl）时 controller 空转，
 *   不阻断 ElectronMainPlugin 启动
 * - **syncNow 异常吞掉**：网络失败 / master_key_locked 等错误已经在 SyncService 内推到
 *   `lastError$`，UI 自然显示；本 controller 只是触发器，无需重复处理
 *
 * 不在 controller 里做的事：
 * - 不读 enabled$——SyncService.syncNow 内部已守门（`!this._enabled$.getValue() → return`），
 *   重复 disable 状态守卫只会让代码更脆，不增加正确性
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
        // 任何窗口聚焦都视作"用户回到 app"——多窗口场景下先聚焦哪个不重要
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
