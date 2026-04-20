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

import type { McpRegistryCategory } from '@termlnk/agent';
import { IMcpRegistryService, IMcpService } from '@termlnk/agent';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const addMcpServerSchema = z.object({
  registryId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  transport: z.enum(['stdio', 'http']),
  config: z.union([
    z.object({
      type: z.literal('stdio'),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string(), z.string()).optional(),
      cwd: z.string().optional(),
    }),
    z.object({
      type: z.literal('http'),
      url: z.string(),
      protocol: z.enum(['streamable-http', 'sse']),
      headers: z.record(z.string(), z.string()).optional(),
    }),
  ]),
  enabled: z.boolean().default(true),
});

const updateMcpServerSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  transport: z.enum(['stdio', 'http']).optional(),
  config: z.union([
    z.object({
      type: z.literal('stdio'),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string(), z.string()).optional(),
      cwd: z.string().optional(),
    }),
    z.object({
      type: z.literal('http'),
      url: z.string(),
      protocol: z.enum(['streamable-http', 'sse']),
      headers: z.record(z.string(), z.string()).optional(),
    }),
  ]).optional(),
});

export type McpRouter = typeof mcpRouter;

export const mcpRouter = router({
  servers: publicProcedure.query(async ({ ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.servers();
  }),
  add: publicProcedure.input(addMcpServerSchema).mutation(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.add(input);
  }),
  remove: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.remove(input);
  }),
  update: publicProcedure.input(updateMcpServerSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updates } = input;
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.update(id, updates);
  }),
  enabled: publicProcedure.input(z.object({
    id: z.string(),
    enabled: z.boolean(),
  })).mutation(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.enabled(input.id, input.enabled);
  }),
  connect: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.connect(input);
  }),
  disconnect: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.disconnect(input);
  }),
  reconnect: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.reconnect(input);
  }),
  getTools: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.getTools(input);
  }),
  getBuiltinTools: publicProcedure.query(async ({ ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.getBuiltinTools();
  }),
  callTool: publicProcedure.input(z.object({
    id: z.string(),
    toolName: z.string(),
    args: z.record(z.string(), z.unknown()),
  })).query(async ({ input, ctx }) => {
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.callTool(input.id, input.toolName, input.args);
  }),
  installFromRegistry: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const registry = ctx.injector.get(IMcpRegistryService);
    const item = await registry.getById(input);
    if (!item) {
      throw new Error('Registry item not found');
    }
    if (item.installOptions.length !== 1 || item.installInputs.length > 0) {
      throw new Error('Registry item requires selecting an installation method and parameters');
    }
    const mcpService = ctx.injector.get(IMcpService);
    return mcpService.add({
      registryId: item.registryId,
      name: item.name,
      description: item.description,
      transport: item.transport,
      config: item.defaultConfig,
      enabled: true,
    });
  }),
  onChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    const mcpService = ctx.injector.get(IMcpService);
    yield* observableToAsyncGenerator(mcpService.onChanged$());
  }),

  // Registry
  getRegistryAll: publicProcedure.query(async ({ ctx }) => {
    const registry = ctx.injector.get(IMcpRegistryService);
    return registry.getAll();
  }),
  searchRegistry: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const registry = ctx.injector.get(IMcpRegistryService);
    return registry.search(input);
  }),
  getRegistryByCategory: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const registry = ctx.injector.get(IMcpRegistryService);
    return registry.getByCategory(input as McpRegistryCategory);
  }),
  getRegistryFeatured: publicProcedure.query(async ({ ctx }) => {
    const registry = ctx.injector.get(IMcpRegistryService);
    return registry.getFeatured();
  }),
});
