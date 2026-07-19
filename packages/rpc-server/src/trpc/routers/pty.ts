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
import { IPTYSessionService } from '@termlnk/terminal';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const sessionIdSchema = z.string();

export type PTYRouter = typeof ptyRouter;

export const ptyRouter = router({
  createSession: publicProcedure
    .input(z.object({
      sessionId: z.string().optional(),
      cols: z.number().optional().default(80),
      rows: z.number().optional().default(24),
      cwd: z.string().optional(),
      shell: z.string().optional(),
      restored: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      return ptySessionService.createSession(input);
    }),

  closeSession: publicProcedure
    .input(sessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      return ptySessionService.closeSession(input);
    }),

  resize: publicProcedure
    .input(z.object({
      sessionId: sessionIdSchema,
      rows: z.number(),
      cols: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      return ptySessionService.resize(input.sessionId, input.rows, input.cols);
    }),

  write: publicProcedure
    .input(z.object({
      sessionId: sessionIdSchema,
      data: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      return ptySessionService.write(input.sessionId, input.data);
    }),

  status$: publicProcedure
    .input(sessionIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      const session = ptySessionService.getSession(input);
      if (!session) {
        throw new Error(`PTY session ${input} not found`);
      }
      yield* observableToAsyncGenerator(session.status$);
    }),

  getShellPath: publicProcedure
    .input(sessionIdSchema)
    .query(async ({ ctx, input }) => {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      return ptySessionService.getShellPath(input);
    }),

  getCurrentCwd: publicProcedure
    .input(sessionIdSchema)
    .query(async ({ ctx, input }) => {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      return ptySessionService.getCurrentCwd(input);
    }),

  getLocalTerminalShellOptions: publicProcedure
    .query(async ({ ctx }) => {
      const ptySessionService = ctx.injector.get(IPTYSessionService);
      return ptySessionService.getLocalTerminalShellOptions();
    }),
});
