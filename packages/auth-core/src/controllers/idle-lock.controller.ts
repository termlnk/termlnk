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

import type { IAuthPluginConfig } from '@termlnk/auth';
import { AUTH_PLUGIN_CONFIG_KEY, IIdleProbe, IMasterKeyService, MasterKeyState } from '@termlnk/auth';
import { IConfigService, ILogService, RxDisposable } from '@termlnk/core';
import { takeUntil } from 'rxjs';

const IDLE_POLL_INTERVAL_MS = 15_000;

export class IdleLockController extends RxDisposable {
  private _intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    @IMasterKeyService private readonly _masterKeyService: IMasterKeyService,
    @IIdleProbe private readonly _idleProbe: IIdleProbe,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
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

  // Auto-lock guards the VAULT, not the identity session. It drops the in-memory master
  // key and the persisted wrap, so the encryption password is required again — while the
  // access/refresh tokens stay put.
  //
  // This deliberately does NOT call IAuthService.logout(): that revokes the session
  // server-side, and /auth/logout revokes every session on the account. On mobile
  // (autoLockIdleMinutes=5, idle == "app in the background") a phone sitting in a pocket
  // would sign the user out of every device they own.
  private async _performLock(): Promise<void> {
    try {
      await this._masterKeyService.clearPersistedKey();
    } catch (err) {
      // Best-effort: locking the in-memory key below still protects this session. A stale
      // wrap only matters on the next cold start, which re-derives from the keystore anyway.
      this._logService.warn('[IdleLockController] failed to clear the persisted master key:', err);
    }
    this._masterKeyService.lock();
  }
}
