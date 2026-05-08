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

/** 认证状态机 */
export enum AuthState {
  /** 未登录或已登出 */
  Unauthenticated = 'unauthenticated',
  /** 正在执行 register/login 流程 */
  Authenticating = 'authenticating',
  /** 已登录；master key 在主进程内存中可用 */
  Authenticated = 'authenticated',
  /** 上次操作失败（详情见 AuthError 事件） */
  Error = 'error',
}

/** Token 对（access + refresh）；仅主进程持有，渲染端永不见 */
export interface ITokenPair {
  /** 短期访问令牌（典型 15 分钟）；用于云服务 RPC 鉴权 */
  accessToken: string;
  /** 长期刷新令牌（典型 30 天）；用于换取新 accessToken */
  refreshToken: string;
  /** accessToken 过期时间戳（ms since epoch） */
  accessTokenExpiresAt: number;
  /** refreshToken 过期时间戳（ms since epoch） */
  refreshTokenExpiresAt: number;
}

/** 认证错误类型（客户端可见，便于 UI 展示具体原因） */
export type AuthErrorCode =
  | 'invalid_credentials' // 邮箱或密码错误
  | 'email_already_registered' // 注册时邮箱已存在
  | 'email_not_verified' // 登录前需先验证邮箱
  | 'rate_limited' // 服务端限流
  | 'network' // 网络错误
  | 'server_error' // 服务端 5xx
  | 'token_expired' // refresh token 过期，需重新登录
  | 'unknown';

export interface IAuthError {
  code: AuthErrorCode;
  message: string;
}
