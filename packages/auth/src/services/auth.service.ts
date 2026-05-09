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
 * 主进程认证服务。
 *
 * 第一性边界：
 * - **明文密码**仅在 register / login 调用栈内瞬时使用——派生 verifier / master key 后立即销毁
 * - **master key**永不跨 IPC（渲染端无法访问；通过 IMasterKeyService 仅主进程内可用）
 * - **token**永不跨 IPC（云 RPC 鉴权由主进程拦截器透明附加；渲染端不见 access/refresh token）
 * - 渲染端通过 IAuthClientService（tRPC 门面）触发动作；状态变化经 currentUser$ / authState$ 推送
 */
export interface IAuthService {
  /** 当前登录用户；null 表示未登录 */
  readonly currentUser$: Observable<IUserAccount | null>;
  /** 认证状态机 */
  readonly authState$: Observable<AuthState>;
  /** 最近一次错误（authState === Error 时有意义） */
  readonly lastError$: Observable<IAuthError | null>;

  /**
   * 注册：客户端派生 SRP6a verifier 上传服务端，服务端只存 verifier hash，
   * 永不见明文密码。注册成功后自动登录（master key 已在内存）。
   */
  register(input: IRegisterInput): Promise<IUserAccount>;

  /**
   * 登录：SRP6a 互证（密码不上传），成功后服务端签发 token，客户端派生 master key。
   */
  login(input: ILoginInput): Promise<IUserAccount>;

  /**
   * 登出：撤销 refresh token、清空 master key、清空本地存储的 token。
   * 即使网络失败也保证本地已登出。
   */
  logout(): Promise<void>;

  /**
   * 获取当前 access token；过期时自动用 refresh token 续。
   * 未登录或 refresh token 也过期 → 返回 null（调用方应触发重新登录流程）。
   */
  getAccessToken(): Promise<string | null>;

  /** 同步获取当前用户（无需订阅 Observable 时用） */
  getCurrentUser(): IUserAccount | null;

  /**
   * 拉取当前账号下所有已登录设备（active refresh tokens）。
   * 返回列表用 lastSeenAt 倒序；当前设备 isCurrent=true。
   */
  listDevices(): Promise<readonly IDevice[]>;

  /**
   * 撤销指定设备（按 IDevice.id 即 refresh-token jti）。
   * - 撤销当前设备 = 远程登出本机；本端的下次 RPC 会因 401 触发自动登出
   * - 撤销其他设备 = 该设备下次刷新 token 时收到 401，强制重新登录
   * - 服务端不区分"撤销不存在的 id"——总是 204；不会泄漏其他用户的 jti 是否存在
   */
  revokeDevice(deviceId: string): Promise<void>;
}

export const IAuthService = createIdentifier<IAuthService>('auth.auth-service');
