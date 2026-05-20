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
import { ISharedTerminalService } from '@termlnk/shared-terminal';
import { announceDeviceSessionInputSchema, connectAsParticipantInputSchema, createInviteInputSchema, deviceIdSchema, inviteIdSchema, kickInputSchema, lockDriverInputSchema, sessionIdSchema, setDriverInputSchema } from '../schema/multiplayer.schema';
import { publicProcedure, router } from '../trpc';

export type MultiplayerRouter = typeof multiplayerRouter;

/**
 * Multiplayer router — thin tRPC binding over the main-process ISharedTerminalService.
 *
 * The renderer's SharedTerminalService (in @termlnk/rpc-client) calls this router
 * for every method; the binding here forwards to the main-process implementation
 * registered by RPCServerPlugin. Both ends speak the same ISharedTerminalService
 * contract, so the only role of this file is the wire serialisation layer.
 */
export const multiplayerRouter = router({
  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  listSessions: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(ISharedTerminalService).listSessions()),

  sessions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).sessions$);
    }),

  participants$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).participants$(input));
    }),

  driverState$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).driverState$(input));
    }),

  // ---------------------------------------------------------------------------
  // Driver
  // ---------------------------------------------------------------------------

  setDriver: publicProcedure
    .input(setDriverInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).setDriver(input.sessionId, input.clientId);
    }),

  lockDriver: publicProcedure
    .input(lockDriverInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).lockDriver(input.sessionId, input.clientId);
    }),

  unlockDriver: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).unlockDriver(input);
    }),

  kick: publicProcedure
    .input(kickInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).kick(input.sessionId, input.clientId, input.reason);
    }),

  // ---------------------------------------------------------------------------
  // Invites
  // ---------------------------------------------------------------------------

  createInvite: publicProcedure
    .input(createInviteInputSchema)
    .mutation(async ({ ctx, input }) => ctx.injector.get(ISharedTerminalService).createInvite(input)),

  revokeInvite: publicProcedure
    .input(inviteIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).revokeInvite(input);
    }),

  listInvites: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(ISharedTerminalService).listInvites()),

  outstandingInvites$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).outstandingInvites$);
    }),

  inviteHistory$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).inviteHistory$);
    }),

  inviteClaims$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).inviteClaims$);
    }),

  // ---------------------------------------------------------------------------
  // Paired devices
  // ---------------------------------------------------------------------------

  pairedDevices$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).pairedDevices$);
    }),

  revokeDevice: publicProcedure
    .input(deviceIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).revokeDevice(input);
    }),

  // ---------------------------------------------------------------------------
  // Sharing lifecycle
  // ---------------------------------------------------------------------------

  listShareable: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(ISharedTerminalService).listShareable()),

  shareable$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).shareable$);
    }),

  shareSshSession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).shareSshSession(input);
    }),

  sharePtySession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).sharePtySession(input);
    }),

  stopSharing: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).stopSharing(input);
    }),

  // ---------------------------------------------------------------------------
  // Deep link intake
  // ---------------------------------------------------------------------------

  inviteUrl$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).inviteUrl$);
    }),

  // ---------------------------------------------------------------------------
  // Participant (joiner)
  // ---------------------------------------------------------------------------

  connectAsParticipant: publicProcedure
    .input(connectAsParticipantInputSchema)
    .mutation(async ({ ctx, input }) =>
      ctx.injector.get(ISharedTerminalService).connectAsParticipant(input.inviteUrl)
    ),

  disconnectParticipant: publicProcedure
    .mutation(async ({ ctx }) => {
      await ctx.injector.get(ISharedTerminalService).disconnectParticipant();
    }),

  participantState$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).participantState$);
    }),

  participantFrames$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).participantFrames$);
    }),

  participantSnapshot$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).participantSnapshot$);
    }),

  participantLastError$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).participantLastError$);
    }),

  // ---------------------------------------------------------------------------
  // Same-account device pairing
  // ---------------------------------------------------------------------------

  listRemoteSessions: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(ISharedTerminalService).listRemoteSessions()),

  remoteSessions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(ISharedTerminalService).remoteSessions$);
    }),

  refreshRemoteSessions: publicProcedure
    .mutation(async ({ ctx }) => {
      await ctx.injector.get(ISharedTerminalService).refreshRemoteSessions();
    }),

  announceDeviceSession: publicProcedure
    .input(announceDeviceSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).announceDeviceSession(input.sessionId, input.title, input.cols, input.rows);
    }),

  retractDeviceSession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(ISharedTerminalService).retractDeviceSession(input);
    }),
});
