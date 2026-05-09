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

import type { IAuthClientService, IAuthError, IDevice, ILoginInput, IRegisterInput, IUserAccount } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { AuthState } from '@termlnk/auth';
import { Disposable, ILogService, Inject, toDisposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

/**
 * 渲染端 IAuthClientService 实现——通过 tRPC 与主进程的 IAuthService 通信。
 *
 * 状态分发：
 * - 构造时启动三条 subscription（currentUser$ / authState$ / lastError$），把
 *   主进程的状态实时镜像到本地 BehaviorSubject。dispose 时一并取消订阅。
 * - 启动后立即拉取一次 getCurrentUser 兜底首次同步——避免 subscription 首次
 *   推送的轻微延迟导致 UI 短暂闪烁"未登录"。
 *
 * 安全语义：
 * - register/login 的 password 经 tRPC 上行——password 在主进程派生 verifier
 *   后即丢弃。这一段瞬时跨 IPC 是架构 §0 明确允许的；其他敏感字段（master key /
 *   access token / refresh token）永不上行。
 * - 渲染端拿不到 access token——同步 RPC 调用走 main-process-side 拦截器附加 token，
 *   渲染端无需感知。
 */
export class AuthClientService extends Disposable implements IAuthClientService {
  private readonly _currentUser$ = new BehaviorSubject<IUserAccount | null>(null);
  readonly currentUser$: Observable<IUserAccount | null> = this._currentUser$.asObservable();

  private readonly _authState$ = new BehaviorSubject<AuthState>(AuthState.Unauthenticated);
  readonly authState$: Observable<AuthState> = this._authState$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<IAuthError | null>(null);
  readonly lastError$: Observable<IAuthError | null> = this._lastError$.asObservable();

  constructor(
    @Inject(IRPCClientService) private readonly _rpcClientService: IRPCClientService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();

    // 兜底：拉取一次当前用户。失败（未配置云）时静默——subscription 也会失败，
    // BehaviorSubject 保持初始值
    void this._client.getCurrentUser.query()
      .then((user) => {
        this._currentUser$.next(user ?? null);
      })
      .catch((err) => {
        this._logService.warn('[AuthClientService] initial getCurrentUser failed:', err);
      });

    const userSub = trpcSubscriptionToObservable<IUserAccount | null>(
      (opts) => this._client.currentUser$.subscribe(undefined, opts)
    ).subscribe({
      next: (user) => this._currentUser$.next(user),
      error: (err) => this._logService.warn('[AuthClientService] currentUser$ stream error:', err),
    });

    const stateSub = trpcSubscriptionToObservable<AuthState>(
      (opts) => this._client.authState$.subscribe(undefined, opts)
    ).subscribe({
      next: (state) => this._authState$.next(state),
      error: (err) => this._logService.warn('[AuthClientService] authState$ stream error:', err),
    });

    const errorSub = trpcSubscriptionToObservable<IAuthError | null>(
      (opts) => this._client.lastError$.subscribe(undefined, opts)
    ).subscribe({
      next: (e) => this._lastError$.next(e),
      error: (err) => this._logService.warn('[AuthClientService] lastError$ stream error:', err),
    });

    this.disposeWithMe(toDisposable(userSub));
    this.disposeWithMe(toDisposable(stateSub));
    this.disposeWithMe(toDisposable(errorSub));
  }

  override dispose(): void {
    this._currentUser$.complete();
    this._authState$.complete();
    this._lastError$.complete();
    super.dispose();
  }

  private get _client() {
    return this._rpcClientService.getClient().auth;
  }

  async register(input: IRegisterInput): Promise<void> {
    await this._client.register.mutate(input);
  }

  async login(input: ILoginInput): Promise<void> {
    await this._client.login.mutate(input);
  }

  async logout(): Promise<void> {
    await this._client.logout.mutate();
  }

  async listDevices(): Promise<readonly IDevice[]> {
    return this._client.listDevices.query();
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this._client.revokeDevice.mutate({ deviceId });
  }
}
