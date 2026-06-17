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
import { ISnippetService } from '@termlnk/snippet';
import { z } from 'zod';
import { createPackageSchema, createSnippetSchema, moveSchema, pasteOrRunSchema, updatePackageSchema, updateSnippetSchema } from '../schema/snippet.schema';
import { publicProcedure, router } from '../trpc';

export type SnippetRouter = typeof snippetRouter;

export const snippetRouter = router({
  // --- Snippet CRUD ---

  getAll: publicProcedure.query(({ ctx }) => ctx.injector.get(ISnippetService).getAll()),

  getById: publicProcedure.input(z.string()).query(({ input, ctx }) => ctx.injector.get(ISnippetService).getById(input)),

  getItem: publicProcedure.input(z.string()).query(({ input, ctx }) => ctx.injector.get(ISnippetService).getItem(input)),

  getChildrenList: publicProcedure.input(z.string()).query(({ input, ctx }) => ctx.injector.get(ISnippetService).getChildrenList(input)),

  create: publicProcedure.input(createSnippetSchema).mutation(({ input, ctx }) =>
    ctx.injector.get(ISnippetService).create({
      ...input,
      pid: input.pid ?? 'root',
      sort: input.sort ?? 0,
      favorite: input.favorite ?? false,
    })
  ),

  update: publicProcedure.input(updateSnippetSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updates } = input;
    await ctx.injector.get(ISnippetService).update(id, updates);
  }),

  delete: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    await ctx.injector.get(ISnippetService).delete(input);
  }),

  // --- Package CRUD ---

  getAllPackages: publicProcedure.query(({ ctx }) => ctx.injector.get(ISnippetService).getAllPackages()),

  getPackageById: publicProcedure.input(z.string()).query(({ input, ctx }) => ctx.injector.get(ISnippetService).getPackageById(input)),

  createPackage: publicProcedure.input(createPackageSchema).mutation(({ input, ctx }) =>
    ctx.injector.get(ISnippetService).createPackage({ ...input, pid: input.pid ?? 'root' })
  ),

  updatePackage: publicProcedure.input(updatePackageSchema).mutation(async ({ input, ctx }) => {
    const { id, ...updates } = input;
    await ctx.injector.get(ISnippetService).updatePackage(id, updates);
  }),

  deletePackage: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    await ctx.injector.get(ISnippetService).deletePackage(input);
  }),

  getExpandedPackageIds: publicProcedure.query(({ ctx }) =>
    ctx.injector.get(ISnippetService).getExpandedPackageIds()
  ),

  setExpandedPackageIds: publicProcedure.input(z.array(z.string())).mutation(async ({ input, ctx }) => {
    await ctx.injector.get(ISnippetService).setExpandedPackageIds(input);
  }),

  // --- Tree & move ---

  getTree: publicProcedure.query(({ ctx }) => ctx.injector.get(ISnippetService).getTree()),

  move: publicProcedure.input(moveSchema).mutation(async ({ input, ctx }) => {
    await ctx.injector.get(ISnippetService).move(input.id, input.targetPid, input.targetSort);
  }),

  // --- Execution ---

  paste: publicProcedure.input(pasteOrRunSchema).mutation(async ({ input, ctx }) => {
    await ctx.injector.get(ISnippetService).paste(input.sessionId, input.content);
  }),

  run: publicProcedure.input(pasteOrRunSchema).mutation(async ({ input, ctx }) => {
    await ctx.injector.get(ISnippetService).run(input.sessionId, input.content);
  }),

  // --- Subscription ---

  onChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(ISnippetService).onChanged$());
  }),
});
