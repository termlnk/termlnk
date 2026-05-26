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

import { Buffer } from 'node:buffer';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { IRemoteSessionService } from '@termlnk/shared-terminal';
import { bufferTime, filter, map } from 'rxjs';
import { createRemoteSessionInputSchema, resizeRemoteSessionInputSchema, sendRemoteSessionControlSchema, sessionIdSchema, writeRemoteSessionInputSchema } from '../schema/shared-terminal.schema';
import { publicProcedure, router } from '../trpc';

export type RemoteSessionRouter = typeof remoteSessionRouter;

/**
 * Joiner-side N-session container — structural twin of `sshRouter` /
 * `ptyRouter`. Every procedure delegates to `IRemoteSessionService`; the
 * router only handles wire serialisation (base64 for PtyData bytes).
 */
export const remoteSessionRouter = router({
  createSession: publicProcedure
    .input(createRemoteSessionInputSchema)
    .mutation(async ({ ctx, input }) =>
      ctx.injector.get(IRemoteSessionService).createSession(input)
    ),

  closeSession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IRemoteSessionService).closeSession(input);
    }),

  write: publicProcedure
    .input(writeRemoteSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(globalThis.atob(input.dataB64), (c) => c.charCodeAt(0));
      } catch (err) {
        throw new Error(`invalid dataB64: ${err instanceof Error ? err.message : String(err)}`);
      }
      await ctx.injector.get(IRemoteSessionService).write(input.sessionId, bytes);
    }),

  resize: publicProcedure
    .input(resizeRemoteSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IRemoteSessionService).resize(input.sessionId, input.rows, input.cols);
    }),

  sendControl: publicProcedure
    .input(sendRemoteSessionControlSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IRemoteSessionService).sendControl(input.sessionId, input.message);
    }),

  sessions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).sessions$);
    }),

  sessionCreated$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).sessionCreated$);
    }),

  sessionClosed$: publicProcedure
    .subscription(async function* ({ ctx }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).sessionClosed$);
    }),

  /**
   * Per-session PTY byte stream. Coalesced over a small window (8 ms) and
   * base64-encoded over the wire — same shape as `sshRouter.data$`, so the
   * renderer-side facade uses the shared `decodeBase64Utf8Stream`.
   */
  data$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const service = ctx.injector.get(IRemoteSessionService);
      const base64$ = service.data$(input).pipe(
        bufferTime(8),
        filter((chunks: Uint8Array[]) => chunks.length > 0),
        map((chunks: Uint8Array[]) => {
          const total = chunks.reduce((sum, c) => sum + c.length, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          return Buffer.from(merged).toString('base64');
        })
      );
      yield* observableToAsyncGenerator(base64$);
    }),

  status$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).status$(input));
    }),

  event$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).event$(input));
    }),

  error$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).error$(input));
    }),

  connectionId$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).connectionId$(input));
    }),

  driverId$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).driverId$(input));
    }),

  inputPolicy$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      yield* observableToAsyncGenerator(ctx.injector.get(IRemoteSessionService).inputPolicy$(input));
    }),
});
