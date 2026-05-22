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

import type { ISyncPluginConfig } from '@termlnk/sync';
import { AuthState, IAuthService, IMasterKeyService, MasterKeyState } from '@termlnk/auth';
import { IConfigService, ILogService, Inject, Optional, RxDisposable } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { ISyncService, SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD } from '@termlnk/sync';
import { combineLatest, distinctUntilChanged, takeUntil } from 'rxjs';

export class AuthSyncBridgeController extends RxDisposable {
  constructor(
    @ISyncService private readonly _syncService: ISyncService,
    @IMasterKeyService private readonly _masterKeyService: IMasterKeyService,
    @IConfigService private readonly _configService: IConfigService,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @ILogService private readonly _logService: ILogService,
    @Optional(IAuthService) private readonly _authService?: IAuthService
  ) {
    super();

    this._initListeners();
  }

  private _initListeners(): void {
    if (!this._authService) {
      this._logService.log('[AuthSyncBridgeController] IAuthService not bound; sync stays manual-only');
      return;
    }

    combineLatest([
      this._authService.authState$,
      this._masterKeyService.state$,
    ])
      .pipe(
        distinctUntilChanged(([a1, m1], [a2, m2]) => a1 === a2 && m1 === m2),
        takeUntil(this.dispose$)
      )
      .subscribe(([authState, masterKeyState]) => {
        // Happy path: signed in + key unlocked -> let SyncService decide whether the user
        // has sync turned on (it persists userEnabled across sessions).
        if (authState === AuthState.Authenticated && masterKeyState === MasterKeyState.Unlocked) {
          void this._restoreSyncIntent();
          return;
        }

        // Signed out -> drop runtime regardless of master key state.
        if (authState === AuthState.Unauthenticated) {
          void this._stopSyncRuntime();
          return;
        }

        // Signed in but key locked (idle-lock fired, or restore failed to unwrap) ->
        // pause the runtime. SyncService.enable()'s crypto.available gate will refuse to
        // restart until the user re-authenticates, so the next combineLatest emission with
        // Unlocked picks it up.
        if (authState === AuthState.Authenticated && masterKeyState === MasterKeyState.Locked) {
          void this._stopSyncRuntime();
        }
        // Authenticating / Error: hold the previous SyncService state during recovery.
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
