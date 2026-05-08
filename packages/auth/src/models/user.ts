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

/** 用户账号（不含敏感字段；可经 IPC 传给渲染端） */
export interface IUserAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly emailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 注册输入：用户输入的明文密码仅在主进程瞬时使用（派生 verifier/master key 后立即销毁） */
export interface IRegisterInput {
  email: string;
  /** 用户主密码——客户端用其派生 verifier；永不发送给服务端，永不持久化 */
  password: string;
  displayName?: string;
}

/** 登录输入 */
export interface ILoginInput {
  email: string;
  password: string;
  /** 是否记住登录态（持久化加密的 refresh token，下次启动免登录） */
  rememberMe?: boolean;
}
