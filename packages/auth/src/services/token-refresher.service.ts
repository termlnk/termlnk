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

import type { ITokenPair } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/**
 * Token 刷新抽象——把"如何调用云服务 /auth/refresh 端点"与
 * "本地缓存 + 自动刷新调度"两个职责解耦。
 *
 * 实现位置：
 * - 主进程 HTTP 实现由 Phase 3 的网络层（或 @termlnk/network 拦截器）提供
 * - 测试用 fake 实现注入即可（不需要真 HTTP）
 *
 * 失败语义：
 * - refresh token 过期 → 抛错（调用方应清空本地 token + 触发重新登录）
 * - 网络/服务端错误 → 抛错（调用方决定重试还是放弃）
 * - 实现**必须保证幂等**：同一 refreshToken 多次调用应得到相同状态（或 token 已被旋转就稳定抛错）
 */
export interface ITokenRefresher {
  refresh(refreshToken: string): Promise<ITokenPair>;
}

export const ITokenRefresher = createIdentifier<ITokenRefresher>('auth.token-refresher');
