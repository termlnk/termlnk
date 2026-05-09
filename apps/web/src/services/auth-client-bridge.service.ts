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

import type { IAuthClientService, IAuthError, IAuthService, IDevice, ILoginInput, IRegisterInput, IUserAccount } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { AuthState, IAuthService as IAuthServiceId } from '@termlnk/auth';
import { Disposable, Inject } from '@termlnk/core';

/**
 * 浏览器端 IAuthClientService 实现——直接转发到 IAuthService（同进程）。
 *
 * 桌面端 IAuthClientService 由 `@termlnk/rpc-client` 通过 tRPC 调主进程；
 * 浏览器没有 main/renderer 拆分，所以 client = service 同一个对象的薄壳。
 *
 * 注意 register/login 返回值差异：
 * - IAuthService → Promise<IUserAccount>（主进程拿到 user）
 * - IAuthClientService → Promise<void>（渲染端不需要 user，订阅 currentUser$ 即可）
 *
 * 这里把 user 吞掉以匹配契约——避免 LoginForm 调用方双重处理状态。
 */
export class AuthClientBridgeService extends Disposable implements IAuthClientService {
  readonly currentUser$: Observable<IUserAccount | null>;
  readonly authState$: Observable<AuthState>;
  readonly lastError$: Observable<IAuthError | null>;

  constructor(
    @Inject(IAuthServiceId) private readonly _auth: IAuthService
  ) {
    super();
    this.currentUser$ = this._auth.currentUser$;
    this.authState$ = this._auth.authState$;
    this.lastError$ = this._auth.lastError$;
  }

  async register(input: IRegisterInput): Promise<void> {
    await this._auth.register(input);
  }

  async login(input: ILoginInput): Promise<void> {
    await this._auth.login(input);
  }

  async logout(): Promise<void> {
    await this._auth.logout();
  }

  async listDevices(): Promise<readonly IDevice[]> {
    return this._auth.listDevices();
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this._auth.revokeDevice(deviceId);
  }
}
