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

import type { IAuthService } from '@termlnk/auth';
import type { ISyncPluginConfig } from '@termlnk/sync';
import { AuthState, IAuthService as IAuthServiceId } from '@termlnk/auth';
import { IConfigService, ILogService, Inject, Optional, RxDisposable } from '@termlnk/core';
import { SYNC_PLUGIN_CONFIG_KEY } from '@termlnk/sync';
import { distinctUntilChanged, takeUntil } from 'rxjs';
import { SyncService } from '../services/sync.service';

// Auto-enables sync on sign-in (subject to autoEnableOnLogin) and always disables on
// sign-out. Decides only the moment-of-sign-in transition; manual SyncStatusPanel toggles
// downstream are never overridden. IAuthService is optional — without it, the listener
// no-ops and SyncService stays Disabled so offline features still work.
export class AuthSyncBridgeController extends RxDisposable {
  private readonly _authService: IAuthService | null;

  constructor(
    @Inject(SyncService) private readonly _syncService: SyncService,
    @Optional(IAuthServiceId) authService: IAuthService | null,
    @IConfigService private readonly _configService: IConfigService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
    this._authService = authService;
    this._initListeners();
  }

  private _initListeners(): void {
    if (!this._authService) {
      this._logService.log('[AuthSyncBridgeController] IAuthService not bound; sync stays manual-only');
      return;
    }

    this._authService.authState$
      .pipe(distinctUntilChanged(), takeUntil(this.dispose$))
      .subscribe((state) => {
        if (state === AuthState.Authenticated) {
          if (this._shouldAutoEnableOnLogin()) {
            void this._enableSync();
          } else {
            this._logService.log('[AuthSyncBridgeController] sign-in observed but autoEnableOnLogin=false; user must enable sync manually');
          }
        } else if (state === AuthState.Unauthenticated) {
          void this._disableSync();
        }
        // `Authenticating` / `Error` don't touch SyncService — keep the previous state during recovery.
      });
  }

  private _shouldAutoEnableOnLogin(): boolean {
    const config = this._configService.getConfig<ISyncPluginConfig>(SYNC_PLUGIN_CONFIG_KEY);
    // Unset falls back to SyncPlugin's defaultPluginConfig (true).
    return config?.autoEnableOnLogin !== false;
  }

  private async _enableSync(): Promise<void> {
    try {
      await this._syncService.enable();
      this._logService.log('[AuthSyncBridgeController] sync enabled after sign-in');
    } catch (err) {
      this._logService.warn('[AuthSyncBridgeController] failed to enable sync:', err);
    }
  }

  private async _disableSync(): Promise<void> {
    try {
      await this._syncService.disable();
      this._logService.log('[AuthSyncBridgeController] sync disabled after sign-out');
    } catch (err) {
      this._logService.warn('[AuthSyncBridgeController] failed to disable sync:', err);
    }
  }
}
