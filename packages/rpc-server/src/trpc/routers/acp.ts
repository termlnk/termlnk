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

import { IACPDiscoveryService, IACPSessionService } from '@termlnk/acp';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import {
  createACPSessionSchema,
  customModelSchema,
  probeCapabilitiesSchema,
  promptSchema,
  respondPermissionSchema,
  sessionIdSchema,
  setModelSchema,
  setModeSchema,
  setProviderEnabledSchema,
  userProviderSchema,
} from '../schema/acp.schema';
import { publicProcedure, router } from '../trpc';

export type ACPRouter = typeof acpRouter;

export const acpRouter = router({
  listProviders: publicProcedure.query(({ ctx }) => {
    return ctx.injector.get(IACPDiscoveryService).providers;
  }),

  refreshProviders: publicProcedure.mutation(async ({ ctx }) => {
    const discovery = ctx.injector.get(IACPDiscoveryService);
    await discovery.refresh();
    return discovery.providers;
  }),

  addUserProvider: publicProcedure.input(userProviderSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPDiscoveryService).addUserProvider(input);
  }),

  removeUserProvider: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPDiscoveryService).removeUserProvider(input);
  }),

  setProviderEnabled: publicProcedure
    .input(setProviderEnabledSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.injector.get(IACPDiscoveryService).setProviderEnabled(input.id, input.enabled);
    }),

  probeCapabilities: publicProcedure
    .input(probeCapabilitiesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.injector.get(IACPDiscoveryService).probeCapabilities(input.id, input.force);
    }),

  addCustomModel: publicProcedure.input(customModelSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPDiscoveryService).addCustomModel(input.providerId, input.modelId);
  }),

  removeCustomModel: publicProcedure.input(customModelSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPDiscoveryService).removeCustomModel(input.providerId, input.modelId);
  }),

  createSession: publicProcedure.input(createACPSessionSchema).mutation(async ({ ctx, input }) => {
    return ctx.injector.get(IACPSessionService).createSession(input);
  }),

  closeSession: publicProcedure.input(sessionIdSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPSessionService).closeSession(input.sessionId);
  }),

  listSessions: publicProcedure.query(({ ctx }) => {
    return ctx.injector.get(IACPSessionService).sessions;
  }),

  prompt: publicProcedure.input(promptSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPSessionService).prompt(input.sessionId, input.blocks);
  }),

  cancel: publicProcedure.input(sessionIdSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPSessionService).cancel(input.sessionId);
  }),

  respondPermission: publicProcedure.input(respondPermissionSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPSessionService).respondPermission(
      input.sessionId,
      input.requestId,
      input.optionId
    );
  }),

  setMode: publicProcedure.input(setModeSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPSessionService).setMode(input.sessionId, input.modeId);
  }),

  setModel: publicProcedure.input(setModelSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IACPSessionService).setModel(input.sessionId, input.modelId);
  }),

  diagnose: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.injector.get(IACPSessionService).diagnose(input);
  }),

  providers$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IACPDiscoveryService).providers$);
  }),

  launchableProviders$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IACPDiscoveryService).launchableProviders$);
  }),

  sessions$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IACPSessionService).sessions$);
  }),

  events$: publicProcedure.input(z.string()).subscription(async function* ({ ctx, input }) {
    yield* observableToAsyncGenerator(ctx.injector.get(IACPSessionService).events$(input));
  }),
});
