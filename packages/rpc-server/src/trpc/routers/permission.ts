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

import { IAgentToolPermissionService, IPermissionRuleService } from '@termlnk/agent';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const ToolPermissionModeSchema = z.enum(['default', 'auto', 'strict', 'plan']);
const ToolPermissionScopeSchema = z.enum(['once', 'session', 'user']);
const ToolPermissionDecisionSchema = z.enum(['allow', 'deny']);

const PermissionRuleAddInputSchema = z.object({
  toolName: z.string(),
  pattern: z.string().optional(),
  matchField: z.string().optional(),
  decision: ToolPermissionDecisionSchema,
});

const PermissionResponseSchema = z.object({
  requestId: z.string(),
  decision: ToolPermissionDecisionSchema,
  scope: ToolPermissionScopeSchema,
  rule: PermissionRuleAddInputSchema.optional(),
  updatedInput: z.unknown().optional(),
});

const rulesRouter = router({
  list: publicProcedure
    .input(z.object({ scope: ToolPermissionScopeSchema.optional() }).optional())
    .query(({ ctx, input }) => {
      const service = ctx.injector.get(IPermissionRuleService);
      return service.listRules(input?.scope);
    }),

  add: publicProcedure
    .input(PermissionRuleAddInputSchema)
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(IPermissionRuleService);
      return service.addUserRule(input);
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IPermissionRuleService);
      await service.removeRule(input.id);
    }),

  rules$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IPermissionRuleService);
      yield* observableToAsyncGenerator(service.rules$);
    }),
});

export const permissionRouter = router({
  getMode: publicProcedure.query(({ ctx }) => {
    const service = ctx.injector.get(IAgentToolPermissionService);
    return service.getMode();
  }),

  setMode: publicProcedure
    .input(z.object({ mode: ToolPermissionModeSchema }))
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(IAgentToolPermissionService);
      service.setMode(input.mode);
    }),

  respond: publicProcedure
    .input(PermissionResponseSchema)
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(IAgentToolPermissionService);
      service.respond(input);
    }),

  clearSessionRules: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ ctx, input }) => {
      const service = ctx.injector.get(IAgentToolPermissionService);
      service.clearSessionRules(input.sessionId);
    }),

  pendingRequests$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAgentToolPermissionService);
      yield* observableToAsyncGenerator(service.pendingRequests$);
    }),

  mode$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAgentToolPermissionService);
      yield* observableToAsyncGenerator(service.mode$);
    }),

  rules: rulesRouter,
});
