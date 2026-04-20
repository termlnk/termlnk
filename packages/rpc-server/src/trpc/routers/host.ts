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

import { HostRepository } from '@termlnk/database';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { createHostSchema, updateHostSchema } from '../schema/host.schema';
import { publicProcedure, router } from '../trpc';

export type HostRouter = typeof hostRouter;

export const hostRouter = router({
  getChildrenList: publicProcedure.input(z.string().optional()).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.getListByPid(input);
  }),
  tree: publicProcedure.input(z.string().optional()).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.getTree(input);
  }),
  getInfo: publicProcedure.input(z.string()).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.getInfoById(input);
  }),
  create: publicProcedure.input(createHostSchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.create(input);
  }),
  update: publicProcedure.input(updateHostSchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.update(input);
  }),
  delete: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.delete(input);
  }),
  move: publicProcedure.input(z.object({
    id: z.string(),
    targetParentId: z.string(),
    index: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.move(input.id, input.targetParentId, input.index);
  }),
  getExpandedIds: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.getExpandedIds();
  }),
  setExpandedIds: publicProcedure.input(z.array(z.string())).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.setExpandedIds(input);
  }),
  copy: publicProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(HostRepository);
    return repo.copy(input);
  }),
  onChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    const repo = ctx.injector.get(HostRepository);
    yield* observableToAsyncGenerator(repo.changed$);
  }),
});
