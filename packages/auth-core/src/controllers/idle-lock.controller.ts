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

/** 多久回查一次 IdleProbe；够频繁让锁定窗口 ≈ 配置阈值，又不至于压 CPU。 */
const IDLE_POLL_INTERVAL_MS = 15_000;

/**
 * 空闲自动锁主密钥控制器（**仅主进程**）。
 *
 * 行为契约（schema 已声明，本控制器是兑现方）：
 * - `IAuthPluginConfig.autoLockIdleMinutes = 0` → 永不自动锁
 * - `> 0` → 用户连续空闲 N 分钟后自动 logout（首选）/ lock master key（兜底）
 *
 * 锁定路径（按优先级）：
 * 1. **IAuthService.logout()**：当 cloudBaseUrl 已配置时首选——清空 token、
 *    锁 master key、authState 转回 Unauthenticated，渲染端 UI 自然刷新到登录页。
 *    HTTP 撤销是 best-effort（HttpAuthService 内吞掉异常），不会阻塞本地登出
 * 2. **IMasterKeyService.lock()**：cloud 未配置时的兜底——只清密钥不动 token
 *    （此时根本没 token 可清）
 *
 * 为什么不只调 lock()：authState 不会变 ➜ 渲染端的 IAuthClientService.authState$
 * 还以为"已登录"，BackupCard 等用 authState 守门的 UI 就开门，但 master key 已没。
 * 一调用就抛技术性错误。logout() 把状态推平，UI 一致性恢复。
 *
 * 设计要点：
 * - **只在 master key 已 Unlocked 时跑轮询**。state 转 Locked 后立即停轮询，
 *   不浪费 CPU；下次 derive 让 state 再回 Unlocked，自动恢复轮询
 * - **每个 tick 重新读 config**——用户改 autoLockIdleMinutes 不需要重启
 * - **getIdleSeconds 抛异常时静默吞掉**——OS 探针挂了宁可不锁也别误锁用户
 * - 平台无关：实际"OS 空闲多少秒"由注入的 IIdleProbe 决定（auth-core 提供
 *   NoopIdleProbe 默认；electron-main 提供 ElectronIdleProbe 包装 powerMonitor）
 */
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
        // logout() 内部已经 best-effort 吞掉网络异常；走到 catch 说明本地状态机
        // 出错——降级到 bare lock 仍然能保证 master key 被清掉
        this._logService.warn('[IdleLockController] logout failed; falling back to bare master-key lock:', err);
      }
    }
    this._masterKeyService.lock();
  }
}
