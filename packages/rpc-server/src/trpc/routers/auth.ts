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
 * Resolve the main-process `IAuthService`. Without `cloudBaseUrl` configured
 * the service is unbound — we throw rather than return null so tRPC callers
 * get an explicit "cloud not configured" signal. This complements
 * `IAuthClientService`'s `Quantity.OPTIONAL` injection: the UI degrades
 * gracefully, the RPC layer fails hard when actually invoked.
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
  /** User master password — transient over IPC; the main process derives the verifier and immediately drops the plaintext reference. */
  password: z.string().min(1),
  displayName: z.string().optional(),
});

const loginInputSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

/**
 * Renderer-facing auth entry point.
 *
 * We **do not** expose synchronous `getAccessToken` / `getCurrentUser`:
 * - Access and refresh tokens **never cross IPC** (architecture §0 security
 *   boundary).
 * - `currentUser` is pushed via the `currentUser$` subscription instead of
 *   exposing a pull query.
 *
 * The `password` field on `register` / `login` is the only sensitive value
 * allowed to travel up-stream, and only transiently — the main process
 * derives the SRP verifier and drops the plaintext immediately.
 */
export const authRouter = router({
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(async ({ input, ctx }) => {
      const authService = requireAuthService(ctx.injector);
      // No user returned — `currentUser$` pushes it to the renderer; the mutation only fires the action.
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

  /** One-shot fetch the renderer uses on startup so it doesn't wait for the first subscription push. */
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

  /** List active devices for the current account (refresh-token jti view). */
  listDevices: publicProcedure
    .query(async ({ ctx }) => {
      const authService = requireAuthService(ctx.injector);
      // tRPC serializer needs a plain array, not a readonly one.
      return [...await authService.listDevices()];
    }),

  /** Revoke a device by `deviceId` (= `IDevice.id`, the refresh-token jti). */
  revokeDevice: publicProcedure
    .input(z.object({ deviceId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const authService = requireAuthService(ctx.injector);
      await authService.revokeDevice(input.deviceId);
    }),
});

export type AuthRouter = typeof authRouter;
