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

import { IAgentHookServerService, IAgentMonitorService } from '@termlnk/agent';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export type AgentMonitorRouter = typeof agentMonitorRouter;

export const agentMonitorRouter = router({
  sessions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAgentMonitorService);
      yield* observableToAsyncGenerator(service.sessions$);
    }),

  hookEvent$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAgentMonitorService);
      yield* observableToAsyncGenerator(service.hookEvent$);
    }),

  /**
   * Stream of pending blocking interactions (approval dialogs and
   * AskUserQuestion pickers). Superseded the old `permissionRequests$`
   * stream; the new union carries a `kind` discriminator so the renderer
   * can branch between the two scene layouts.
   */
  pendingInteractions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const hookServer = ctx.injector.get(IAgentHookServerService);
      yield* observableToAsyncGenerator(hookServer.pendingInteractions$);
    }),

  getSessions: publicProcedure
    .query(({ ctx }) => {
      return ctx.injector.get(IAgentMonitorService).getSessions();
    }),

  respondPermission: publicProcedure
    .input(z.object({
      requestId: z.string(),
      decision: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('allow') }),
        z.object({ kind: z.literal('deny') }),
        z.object({ kind: z.literal('answer'), label: z.string().min(1) }),
      ]),
    }))
    .mutation(({ ctx, input }) => {
      const hookServer = ctx.injector.get(IAgentHookServerService);
      hookServer.respondPermission(input.requestId, input.decision);
    }),

  dismissSession: publicProcedure
    .input(z.string())
    .mutation(({ ctx, input }) => {
      ctx.injector.get(IAgentMonitorService).removeSession(input);
    }),
});
