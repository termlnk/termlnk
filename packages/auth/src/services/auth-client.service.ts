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

import type { Observable } from 'rxjs';
import type { IDevice } from '../models/device';
import type { AuthState, IAuthError } from '../models/session';
import type { ILoginInput, IRegisterInput, IUserAccount } from '../models/user';
import { createIdentifier } from '@termlnk/core';

/**
 * 渲染端认证门面。
 *
 * 与 IAuthService 的接口表面看起来相似，但语义不同：
 * - 渲染端永远拿不到 master key / access token / refresh token
 * - 仅暴露用户可观察的状态（currentUser / authState）和触发动作的入口
 * - 通过 tRPC 与主进程通信；password 在 register/login 调用栈内瞬时上行
 */
export interface IAuthClientService {
  readonly currentUser$: Observable<IUserAccount | null>;
  readonly authState$: Observable<AuthState>;
  readonly lastError$: Observable<IAuthError | null>;

  register(input: IRegisterInput): Promise<void>;
  login(input: ILoginInput): Promise<void>;
  logout(): Promise<void>;

  listDevices(): Promise<readonly IDevice[]>;
  revokeDevice(deviceId: string): Promise<void>;
}

export const IAuthClientService = createIdentifier<IAuthClientService>('auth.auth-client-service');
