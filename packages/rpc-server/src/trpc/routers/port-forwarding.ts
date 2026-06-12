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

import { IPortForwardingService, observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { portForwardingCreateRuleSchema, portForwardingRespondChangePasswordSchema, portForwardingRespondHostKeySchema, portForwardingRespondKbInteractiveSchema, portForwardingRuleIdSchema, portForwardingStartRuleSchema, portForwardingUpdateRuleSchema } from '../schema/port-forwarding.schema';
import { publicProcedure, router } from '../trpc';

export type PortForwardingRouter = typeof portForwardingRouter;

export const portForwardingRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.injector.get(IPortForwardingService).listRules();
  }),

  create: publicProcedure
    .input(portForwardingCreateRuleSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).createRule(input);
    }),

  update: publicProcedure
    .input(portForwardingUpdateRuleSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).updateRule(input.id, input.patch);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).deleteRule(input.id);
    }),

  start: publicProcedure
    .input(portForwardingStartRuleSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).startRule(input.ruleId, { password: input.password });
    }),

  stop: publicProcedure
    .input(portForwardingRuleIdSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).stopRule(input.ruleId);
    }),

  restart: publicProcedure
    .input(portForwardingStartRuleSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).restartRule(input.ruleId, { password: input.password });
    }),

  respondKeyboardInteractive: publicProcedure
    .input(portForwardingRespondKbInteractiveSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).respondKeyboardInteractive(input.ruleId, input.responses);
    }),

  respondChangePassword: publicProcedure
    .input(portForwardingRespondChangePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).respondChangePassword(input.ruleId, input.newPassword);
    }),

  respondHostKeyPrompt: publicProcedure
    .input(portForwardingRespondHostKeySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IPortForwardingService).respondHostKeyPrompt(input.ruleId, input.action);
    }),

  rules$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IPortForwardingService).rules$);
  }),

  state$: publicProcedure
    .input(portForwardingRuleIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const service = ctx.injector.get(IPortForwardingService);
      yield* observableToAsyncGenerator(service.state$(input.ruleId));
    }),

  authEvent$: publicProcedure
    .input(portForwardingRuleIdSchema)
    .subscription(async function* ({ ctx, input }) {
      const service = ctx.injector.get(IPortForwardingService);
      yield* observableToAsyncGenerator(service.authEvent$(input.ruleId));
    }),
});
