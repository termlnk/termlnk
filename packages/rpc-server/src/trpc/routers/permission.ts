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

import { ICommandPermissionService } from '@termlnk/agent';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const permissionRouter = router({
  getMode: publicProcedure.query(async ({ ctx }) => {
    const service = ctx.injector.get(ICommandPermissionService);
    return firstValueFrom(service.mode$);
  }),

  setMode: publicProcedure
    .input(z.object({
      mode: z.enum(['default', 'auto', 'strict']),
    }))
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(ICommandPermissionService);
      service.setMode(input.mode);
    }),

  respond: publicProcedure
    .input(z.object({
      requestId: z.string(),
      decision: z.enum(['allow', 'deny']),
      rememberForSession: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(ICommandPermissionService);
      service.respondToRequest(input);
    }),

  clearSessionCache: publicProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(ICommandPermissionService);
      service.clearSessionCache(input.sessionId);
    }),

  pendingRequests$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(ICommandPermissionService);
      yield* observableToAsyncGenerator(service.pendingRequests$);
    }),

  mode$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(ICommandPermissionService);
      yield* observableToAsyncGenerator(service.mode$);
    }),
});
