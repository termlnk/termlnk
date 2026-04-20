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

import { IUpdaterService } from '@termlnk/electron';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { publicProcedure, router } from '@termlnk/rpc-server';
import { z } from 'zod';

export const updaterRouter = router({
  getCurrentVersion: publicProcedure.query(async ({ ctx }) => {
    const updaterService = ctx.injector.get(IUpdaterService);
    return updaterService.getCurrentVersion();
  }),

  getStatus: publicProcedure.query(({ ctx }) => {
    return ctx.injector.get(IUpdaterService).getStatus();
  }),

  checkForUpdates: publicProcedure.mutation(async ({ ctx }) => {
    return ctx.injector.get(IUpdaterService).checkForUpdates();
  }),

  downloadUpdate: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.injector.get(IUpdaterService).downloadUpdate();
  }),

  quitAndInstall: publicProcedure
    .input(z.object({
      isSilent: z.boolean().optional().default(false),
      isForceRunAfter: z.boolean().optional().default(true),
    }))
    .mutation(({ ctx, input }) => {
      ctx.injector.get(IUpdaterService).quitAndInstall(input.isSilent, input.isForceRunAfter);
    }),

  status$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IUpdaterService).status$);
  }),

  updateInfo$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IUpdaterService).updateInfo$);
  }),

  progress$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IUpdaterService).progress$);
  }),

  error$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IUpdaterService).error$);
  }),
});

export type UpdaterRouter = typeof updaterRouter;
