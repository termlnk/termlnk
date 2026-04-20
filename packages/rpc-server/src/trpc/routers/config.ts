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

import { ConfigRepository } from '@termlnk/database';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { z } from 'zod';
import { configFieldDeleteSchema, configFieldGetSchema, configFieldSetSchema, configKeySchema, configSetManySchema, configSetSchema } from '../schema/config.schema';
import { publicProcedure, router } from '../trpc';

export type ConfigRouter = typeof configRouter;

export const configRouter = router({
  get: publicProcedure.input(configKeySchema).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.get(input);
  }),
  getMany: publicProcedure.input(z.array(configKeySchema)).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.getMany(input);
  }),
  set: publicProcedure.input(configSetSchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.set(input.key, input.value);
  }),
  setMany: publicProcedure.input(configSetManySchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.setMany(input);
  }),
  delete: publicProcedure.input(configKeySchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.delete(input);
  }),
  getAll: publicProcedure.query(async ({ ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.getAll();
  }),
  getField: publicProcedure.input(configFieldGetSchema).query(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.getField(input.key, input.field);
  }),
  setField: publicProcedure.input(configFieldSetSchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.setField(input.key, input.field, input.value);
  }),
  deleteField: publicProcedure.input(configFieldDeleteSchema).mutation(async ({ input, ctx }) => {
    const repo = ctx.injector.get(ConfigRepository);
    return repo.deleteField(input.key, input.field);
  }),
  onChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    const repo = ctx.injector.get(ConfigRepository);
    yield* observableToAsyncGenerator(repo.changed$);
  }),
});
