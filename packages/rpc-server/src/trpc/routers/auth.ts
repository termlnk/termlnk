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
import type { Injector } from '@termlnk/core';
import { IAuthService as IAuthServiceId } from '@termlnk/auth';
import { Quantity } from '@termlnk/core';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

/**
 * 取主进程 IAuthService；未配置 cloudBaseUrl 时未注册——抛错而不是返回 null，
 * 让 tRPC 调用方收到明确的"云未配置"信号（与 IAuthClientService 的 Quantity.OPTIONAL
 * 注入降级互补：UI 层用 OPTIONAL 优雅退化，RPC 层在真要调用时硬失败）。
 */
function requireAuthService(injector: Injector): IAuthService {
  const service = injector.get(IAuthServiceId, Quantity.OPTIONAL);
  if (!service) {
    throw new Error('cloud auth service is not configured (set cloudBaseUrl in AuthCorePlugin)');
  }
  return service;
}

const registerInputSchema = z.object({
  email: z.string().min(1),
  /** 用户主密码——瞬时跨 IPC，主进程派生 verifier 后即丢弃。 */
  password: z.string().min(1),
  displayName: z.string().optional(),
});

const loginInputSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

/**
 * 渲染端认证入口。
 *
 * **不暴露** getAccessToken / getCurrentUser 同步方法——
 * - access/refresh token **永不跨 IPC**（架构 §0 安全边界）
 * - currentUser 通过 currentUser$ 订阅推送（避免渲染端拉式查询）
 *
 * register/login 的 password 是唯一允许瞬时上行的敏感字段；主进程派生 SRP verifier
 * 后即丢弃明文引用。
 */
export const authRouter = router({
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(async ({ input, ctx }) => {
      const authService = requireAuthService(ctx.injector);
      // 不返回 user——currentUser$ 订阅会推送给渲染端；mutation 仅负责触发动作
      await authService.register(input);
    }),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(async ({ input, ctx }) => {
      const authService = requireAuthService(ctx.injector);
      await authService.login(input);
    }),

  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      const authService = requireAuthService(ctx.injector);
      await authService.logout();
    }),

  /** 渲染端启动时拉取一次当前已知状态，避免等待第一次 subscription 推送。 */
  getCurrentUser: publicProcedure
    .query(({ ctx }) => {
      const service = ctx.injector.get(IAuthServiceId, Quantity.OPTIONAL);
      return service?.getCurrentUser() ?? null;
    }),

  currentUser$: publicProcedure.subscription(async function* ({ ctx }) {
    const authService = requireAuthService(ctx.injector);
    yield* observableToAsyncGenerator(authService.currentUser$);
  }),

  authState$: publicProcedure.subscription(async function* ({ ctx }) {
    const authService = requireAuthService(ctx.injector);
    yield* observableToAsyncGenerator(authService.authState$);
  }),

  lastError$: publicProcedure.subscription(async function* ({ ctx }) {
    const authService = requireAuthService(ctx.injector);
    yield* observableToAsyncGenerator(authService.lastError$);
  }),
});

export type AuthRouter = typeof authRouter;
