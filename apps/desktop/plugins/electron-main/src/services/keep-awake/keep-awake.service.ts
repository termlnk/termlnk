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
import type { IKeepAwakeService } from '@termlnk/electron';
import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { powerSaveBlocker } from 'electron';

export class KeepAwakeService extends Disposable implements IKeepAwakeService {
  // 引用计数：每次 acquire 注册唯一 Symbol；集合非空时保持 OS 级 blocker
  private readonly _holders = new Set<symbol>();
  private _blockerId: number | null = null;

  constructor(@ILogService private readonly _logService: ILogService) {
    super();
    this.disposeWithMe(toDisposable(() => {
      this._holders.clear();
      this._stopBlocker();
    }));
  }

  acquire(reason: string): IDisposable {
    const id = Symbol(reason);
    this._holders.add(id);
    this._startBlocker(reason);

    return toDisposable(() => {
      if (!this._holders.delete(id)) {
        return;
      }
      if (this._holders.size === 0) {
        this._stopBlocker();
      }
    });
  }

  private _startBlocker(reason: string): void {
    if (this._blockerId !== null) {
      return;
    }
    this._blockerId = powerSaveBlocker.start('prevent-display-sleep');
    this._logService.log(`[KeepAwakeService] start blocker=${this._blockerId} reason=${reason}`);
  }

  private _stopBlocker(): void {
    if (this._blockerId === null) {
      return;
    }
    if (powerSaveBlocker.isStarted(this._blockerId)) {
      powerSaveBlocker.stop(this._blockerId);
    }
    this._logService.log(`[KeepAwakeService] stop blocker=${this._blockerId}`);
    this._blockerId = null;
  }
}
