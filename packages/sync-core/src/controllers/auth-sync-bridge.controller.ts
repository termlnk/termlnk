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

/**
 * 认证→同步状态桥接控制器（**仅主进程**）。
 *
 * 用户成功登录 → 按 `ISyncPluginConfig.autoEnableOnLogin` 决定是否 enable；
 * 登出 → 永远 disable（auth 不在了，sync 也跑不了）。
 *
 * 用户手动开关：登录后即使 autoEnableOnLogin=false，用户仍可通过 SyncStatusPanel
 * 的 Enable Switch 主动启用——本 controller 只做"登录瞬间是否自动启用"的决策，
 * 不会反复推翻用户的手动选择。
 *
 * 设计要点：
 * - IAuthService 是 Quantity.OPTIONAL：未配置 cloudBaseUrl 时本控制器构造仍成功
 *   但订阅源不存在——`_authService` 为 null 时 _initListeners 什么也不做，
 *   SyncService 保持 Disabled 状态（用户仍可单独使用 P2.7 加密备份等离线功能）
 * - distinctUntilChanged 防抖：authState$ 内部可能在错误恢复时短时间多次推同值
 * - 每次 Authenticated 转换时**重新读 config**——用户改 autoEnableOnLogin 后
 *   重新登录就能看到新行为，不需要重启
 * - enable/disable 是 idempotent（SyncService 内部有 `_enabled$` 守卫），
 *   所以重复触发不会出问题，但 distinctUntilChanged 还是首选——少一次 RPC 链
 *
 * 不在 controller 里做的事：
 * - 不读 IAuthService.currentUser$——authState 已经是充分信号
 * - 不处理 token 刷新失败导致的隐式登出（TokenManager 内部 fail-soft 已经
 *   把状态推回 Unauthenticated，本 controller 收到信号后自然 disable）
 */
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
        // Authenticating / Error 状态不动 SyncService——错误恢复期间保留之前的同步状态
      });
  }

  private _shouldAutoEnableOnLogin(): boolean {
    const config = this._configService.getConfig<ISyncPluginConfig>(SYNC_PLUGIN_CONFIG_KEY);
    // 未设置时按 SyncPlugin defaultPluginConfig 走（true）
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
