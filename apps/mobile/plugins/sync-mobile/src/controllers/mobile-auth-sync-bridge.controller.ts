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

import type { IAuthService, IMasterKeyService } from '@termlnk/auth';
import type { ILogService } from '@termlnk/core';
import type { IMobileSyncService } from '../services/mobile-sync.service';
import { AuthState, IAuthService as IAuthServiceId, IMasterKeyService as IMasterKeyServiceId, MasterKeyState } from '@termlnk/auth';
import { Disposable, ILogService as ILogServiceId, Inject, Optional } from '@termlnk/core';
import { combineLatest, distinctUntilChanged } from 'rxjs';
import { IMobileSyncService as IMobileSyncServiceId } from '../services/mobile-sync.service';

// Mobile counterpart of sync-core's AuthSyncBridgeController. The desktop bridge lives in
// @termlnk/sync-core and injects @termlnk/database's ConfigRepository (better-sqlite3) to
// read persisted sync intent — neither is available under React Native, so mobile drives
// the lightweight IMobileSyncService facade instead. Without this controller nothing calls
// pull()/enable() on startup, so the vault renders an empty local DB until a screen happens
// to trigger a manual pull.
export class MobileAuthSyncBridgeController extends Disposable {
  // Field-declaration + body-assignment form avoids parameter-property syntax, which
  // babel-plugin-parameter-decorator cannot pair with parameter decorators.
  private readonly _syncService: IMobileSyncService;
  private readonly _masterKeyService: IMasterKeyService;
  private readonly _logService: ILogService;
  private readonly _authService?: IAuthService;

  constructor(
    @Inject(IMobileSyncServiceId) syncService: IMobileSyncService,
    @Inject(IMasterKeyServiceId) masterKeyService: IMasterKeyService,
    @Inject(ILogServiceId) logService: ILogService,
    @Optional(IAuthServiceId) authService?: IAuthService
  ) {
    super();
    this._syncService = syncService;
    this._masterKeyService = masterKeyService;
    this._logService = logService;
    this._authService = authService;

    this._initListeners();
  }

  private _initListeners(): void {
    if (!this._authService) {
      this._logService.log('[MobileAuthSyncBridgeController] IAuthService not bound; sync stays manual-only');
      return;
    }

    this.disposeWithMe(
      combineLatest([this._authService.authState$, this._masterKeyService.state$])
        .pipe(distinctUntilChanged(([a1, m1], [a2, m2]) => a1 === a2 && m1 === m2))
        .subscribe(([authState, masterKeyState]) => {
          // Signed in + key unlocked -> kick the engine. pull() enables it on first call.
          if (authState === AuthState.Authenticated && masterKeyState === MasterKeyState.Unlocked) {
            void this._startSync();
            return;
          }

          // Signed out -> drop the runtime regardless of master key state.
          if (authState === AuthState.Unauthenticated) {
            void this._stopSync();
            return;
          }

          // Signed in but key locked (idle-lock fired, or restore failed to unwrap) ->
          // pause the runtime. The next emission with Unlocked re-enables it.
          if (authState === AuthState.Authenticated && masterKeyState === MasterKeyState.Locked) {
            void this._stopSync();
          }
          // Restoring / Authenticating: hold the previous state during recovery.
        })
    );
  }

  private async _startSync(): Promise<void> {
    try {
      await this._syncService.pull();
    } catch (err) {
      this._logService.warn('[MobileAuthSyncBridgeController] failed to start sync:', err);
    }
  }

  private async _stopSync(): Promise<void> {
    try {
      await this._syncService.stop();
    } catch (err) {
      this._logService.warn('[MobileAuthSyncBridgeController] failed to stop sync:', err);
    }
  }
}
