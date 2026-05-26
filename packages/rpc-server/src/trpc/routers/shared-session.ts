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

import { observableToAsyncGenerator } from '@termlnk/rpc';
import { ISharedSessionService } from '@termlnk/shared-terminal';
import { kickInputSchema, lockDriverInputSchema, sessionIdSchema, setDriverInputSchema, setSharedSessionTitleSchema } from '../schema/shared-terminal.schema';
import { publicProcedure, router } from '../trpc';

export type SharedSessionRouter = typeof sharedSessionRouter;

/**
 * Owner-side control plane — sessions, participants, driver arbitration, and
 * sharing lifecycle. Pure thin tRPC binding over `ISharedSessionService`.
 */
export const sharedSessionRouter = router({
  // Sessions
  listSessions: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(ISharedSessionService).listSessions()),

  sessions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedSessionService).sessions$);
    }),

  participants$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedSessionService).participants$(input));
    }),

  driverState$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedSessionService).driverState$(input));
    }),

  // Driver arbitration
  setDriver: publicProcedure
    .input(setDriverInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).setDriver(input.sessionId, input.clientId);
    }),

  lockDriver: publicProcedure
    .input(lockDriverInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).lockDriver(input.sessionId, input.clientId);
    }),

  unlockDriver: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).unlockDriver(input);
    }),

  kick: publicProcedure
    .input(kickInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).kick(input.sessionId, input.clientId, input.reason);
    }),

  // Sharing lifecycle
  shareable$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedSessionService).shareable$);
    }),

  listShareable: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(ISharedSessionService).listShareable()),

  shareSshSession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).shareSshSession(input);
    }),

  sharePtySession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).sharePtySession(input);
    }),

  stopSharing: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).stopSharing(input);
    }),

  setSessionTitle: publicProcedure
    .input(setSharedSessionTitleSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedSessionService).setSessionTitle(input.sessionId, input.title);
    }),
});
