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
import { ConfigRepository } from '@termlnk/database';
import { SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD } from '@termlnk/sync';
import { distinctUntilChanged, takeUntil } from 'rxjs';
import { SyncService } from '../services/sync.service';

// IAuthService is @Optional — without it (no cloudBaseUrl configured) the listener
// no-ops so offline features still work.
export class AuthSyncBridgeController extends RxDisposable {
  private readonly _authService: IAuthService | null;

  constructor(
    @Inject(SyncService) private readonly _syncService: SyncService,
    @Optional(IAuthServiceId) authService: IAuthService | null,
    @IConfigService private readonly _configService: IConfigService,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
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
          void this._restoreSyncIntent();
        } else if (state === AuthState.Unauthenticated) {
          void this._stopSyncRuntime();
        }
        // Authenticating / Error hold the previous SyncService state during recovery.
      });
  }

  private _shouldAutoEnableOnLogin(): boolean {
    const config = this._configService.getConfig<ISyncPluginConfig>(SYNC_PLUGIN_CONFIG_KEY);
    return config?.autoEnableOnLogin !== false;
  }

  private async _restoreSyncIntent(): Promise<void> {
    try {
      const persisted = await this._configRepo.getField<boolean>(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD);
      if (persisted === false) {
        return;
      }
      // undefined falls back to autoEnableOnLogin; SyncService.enable will write
      // userEnabled=true so subsequent restarts skip the fallback path entirely.
      if (persisted !== true && !this._shouldAutoEnableOnLogin()) {
        return;
      }
      await this._syncService.enable();
    } catch (err) {
      this._logService.warn('[AuthSyncBridgeController] failed to restore sync intent:', err);
    }
  }

  private async _stopSyncRuntime(): Promise<void> {
    try {
      await this._syncService.stopRuntime();
    } catch (err) {
      this._logService.warn('[AuthSyncBridgeController] failed to stop sync runtime:', err);
    }
  }
}
