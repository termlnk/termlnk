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
 * `IAuthService`'s `Quantity.OPTIONAL` injection: the UI degrades
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

  /** Cloud authorize URL the renderer opens in the system browser (Google sign-in). */
  getGoogleAuthorizeUrl: publicProcedure
    .query(({ ctx }) => {
      const authService = requireAuthService(ctx.injector);
      return authService.getGoogleAuthorizeUrl();
    }),

  /**
   * Begin a browser-shell Google sign-in. The web shell has no `termlnk://` deep
   * link and its domain can't be registered with Google, so the relay code is
   * held server-side against a device code and pulled via pollGoogleWebSignIn —
   * loginWithGoogle is never exposed to the renderer (desktop drives it from the
   * main-process deep-link handler).
   */
  beginGoogleWebSignIn: publicProcedure
    .mutation(({ ctx }) => {
      const authService = requireAuthService(ctx.injector);
      return authService.beginGoogleWebSignIn();
    }),

  /** Poll the in-flight web sign-in; claims the session in place once ready. */
  pollGoogleWebSignIn: publicProcedure
    .mutation(({ ctx }) => {
      const authService = requireAuthService(ctx.injector);
      return authService.pollGoogleWebSignIn();
    }),

  /** Optional sign-in methods the cloud server advertises (gates the Google button). */
  getServerCapabilities: publicProcedure
    .query(({ ctx }) => {
      const authService = requireAuthService(ctx.injector);
      return authService.getServerCapabilities();
    }),

  /**
   * Set the encryption password for the first time (OAuth accounts). `password`
   * travels transiently over IPC — same trust boundary as login: the main
   * process derives the key and drops the plaintext immediately.
   */
  setupEncryptionPassword: publicProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const authService = requireAuthService(ctx.injector);
      await authService.setupEncryptionPassword(input.password);
    }),

  /** Unlock the vault on a device that already has an encryption password set. */
  unlockVault: publicProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const authService = requireAuthService(ctx.injector);
      await authService.unlockVault(input.password);
    }),

  vaultState$: publicProcedure.subscription(async function* ({ ctx }) {
    const authService = requireAuthService(ctx.injector);
    yield* observableToAsyncGenerator(authService.vaultState$);
  }),
});

export type AuthRouter = typeof authRouter;
