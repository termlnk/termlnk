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
import { IDevicePairingService } from '@termlnk/shared-terminal';
import { announceDeviceSessionInputSchema, sessionIdSchema } from '../schema/shared-terminal.schema';
import { publicProcedure, router } from '../trpc';

export type DevicePairingRouter = typeof devicePairingRouter;

/**
 * Same-account multi-device pairing. Thin tRPC binding over
 * `IDevicePairingService` — the cloud announce/poll lifecycle.
 */
export const devicePairingRouter = router({
  listRemoteSessions: publicProcedure
    .query(async ({ ctx }) => ctx.injector.get(IDevicePairingService).list()),

  remoteSessions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IDevicePairingService).remoteSessions$);
    }),

  refreshRemoteSessions: publicProcedure
    .mutation(async ({ ctx }) => {
      await ctx.injector.get(IDevicePairingService).refresh();
    }),

  announceDeviceSession: publicProcedure
    .input(announceDeviceSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IDevicePairingService).announceSession(input.sessionId, input.title, input.cols, input.rows);
    }),

  retractDeviceSession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IDevicePairingService).retractSession(input);
    }),
});
