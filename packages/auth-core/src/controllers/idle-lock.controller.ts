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

import type { IAuthPluginConfig, IAuthService, IIdleProbe, IMasterKeyService } from '@termlnk/auth';
import { AUTH_PLUGIN_CONFIG_KEY, IAuthService as IAuthServiceId, IIdleProbe as IIdleProbeId, IMasterKeyService as IMasterKeyServiceId, MasterKeyState } from '@termlnk/auth';
import { IConfigService, ILogService, Inject, Optional, RxDisposable } from '@termlnk/core';
import { takeUntil } from 'rxjs';

const IDLE_POLL_INTERVAL_MS = 15_000;

// Auto-locks the master key after `autoLockIdleMinutes` of inactivity (0 disables).
// Prefers IAuthService.logout() when bound so tokens + authState are cleared together;
// falls back to a bare master-key lock. Polling runs only while Unlocked. Probe
// exceptions are swallowed — failing closed would punish users when the OS API hiccups.
export class IdleLockController extends RxDisposable {
  private _intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(IMasterKeyServiceId) private readonly _masterKeyService: IMasterKeyService,
    @Inject(IIdleProbeId) private readonly _idleProbe: IIdleProbe,
    @IConfigService private readonly _configService: IConfigService,
    @Inject(ILogService) private readonly _logService: ILogService,
    @Optional(IAuthServiceId) private readonly _authService: IAuthService | null = null
  ) {
    super();

    this._masterKeyService.state$
      .pipe(takeUntil(this.dispose$))
      .subscribe((state) => {
        if (state === MasterKeyState.Unlocked) {
          this._startPolling();
        } else {
          this._stopPolling();
        }
      });
  }

  override dispose(): void {
    this._stopPolling();
    super.dispose();
  }

  private _startPolling(): void {
    if (this._intervalId !== null) {
      return;
    }
    this._intervalId = setInterval(() => this._tick(), IDLE_POLL_INTERVAL_MS);
  }

  private _stopPolling(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  private _tick(): void {
    const config = this._configService.getConfig<IAuthPluginConfig>(AUTH_PLUGIN_CONFIG_KEY);
    const minutes = config?.autoLockIdleMinutes ?? 0;
    if (minutes <= 0) {
      return;
    }

    let idleSeconds: number;
    try {
      idleSeconds = this._idleProbe.getIdleSeconds();
    } catch (err) {
      this._logService.warn('[IdleLockController] idle probe threw; skipping tick:', err);
      return;
    }

    if (idleSeconds >= minutes * 60) {
      this._logService.log(`[IdleLockController] auto-locking after ${idleSeconds}s idle (threshold ${minutes}m)`);
      void this._performLock();
    }
  }

  private async _performLock(): Promise<void> {
    if (this._authService) {
      try {
        await this._authService.logout();
        return;
      } catch (err) {
        // logout() absorbs network errors; reaching here means the local state machine
        // itself failed. Fall back to bare lock so the key is still cleared.
        this._logService.warn('[IdleLockController] logout failed; falling back to bare master-key lock:', err);
      }
    }
    this._masterKeyService.lock();
  }
}
