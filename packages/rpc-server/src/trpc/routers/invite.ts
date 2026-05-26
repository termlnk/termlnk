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
import { IInviteService } from '@termlnk/shared-terminal';
import { createInviteInputSchema, deviceIdSchema, inviteIdSchema } from '../schema/shared-terminal.schema';
import { publicProcedure, router } from '../trpc';

export type InviteRouter = typeof inviteRouter;

/**
 * Invite lifecycle + deep-link inflow.
 *
 * `inviteUrl$` is the OS-deep-link bus pull — the renderer subscribes and
 * pops the JoinDialog when a `termlnk://invite#...` URL arrives.
 */
export const inviteRouter = router({
  // Owner-side invite lifecycle
  createInvite: publicProcedure
    .input(createInviteInputSchema)
    .mutation(async ({ ctx, input }) => ctx.injector.get(IInviteService).createInvite(input)),

  revokeInvite: publicProcedure
    .input(inviteIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IInviteService).revokeInvite(input);
    }),

  listInvites: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(IInviteService).listInvites()),

  outstandingInvites$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IInviteService).outstandingInvites$);
    }),

  inviteHistory$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IInviteService).inviteHistory$);
    }),

  inviteClaims$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IInviteService).inviteClaims$);
    }),

  // Paired devices
  pairedDevices$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IInviteService).pairedDevices$);
    }),

  revokeDevice: publicProcedure
    .input(deviceIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IInviteService).revokeDevice(input);
    }),

  // Deep link intake
  inviteUrl$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IInviteService).inviteUrl$);
    }),
});
