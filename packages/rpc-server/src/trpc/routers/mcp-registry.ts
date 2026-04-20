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
import { IMcpRegistryService } from '@termlnk/agent';
import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export type McpRegistryRouter = typeof mcpRegistryRouter;

export const mcpRegistryRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const mcpRegistryService = ctx.injector.get(IMcpRegistryService);
    return mcpRegistryService.getAll();
  }),
  getById: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const mcpRegistryService = ctx.injector.get(IMcpRegistryService);
    return mcpRegistryService.getById(input);
  }),
  search: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const mcpRegistryService = ctx.injector.get(IMcpRegistryService);
    return mcpRegistryService.search(input);
  }),
  getByCategory: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const mcpRegistryService = ctx.injector.get(IMcpRegistryService);
    return mcpRegistryService.getByCategory(input as McpRegistryCategory);
  }),
  getFeatured: publicProcedure.query(async ({ ctx }) => {
    const mcpRegistryService = ctx.injector.get(IMcpRegistryService);
    return mcpRegistryService.getFeatured();
  }),
});
