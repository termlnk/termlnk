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

import { IProjectFsService, IProjectGitService } from '@termlnk/project';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { ICommandBlockService } from '../../services/shell-integration/command-block.service';
import {
  gitCheckoutSchema,
  gitCommitSchema,
  gitDiffSchema,
  gitLogSchema,
  gitNumstatSchema,
  gitPathsSchema,
  projectContextSchema,
  projectPathSchema,
  projectWriteSchema,
} from '../schema/project.schema';
import { publicProcedure, router } from '../trpc';

export type ProjectRouter = typeof projectRouter;

export const projectRouter = router({
  // --- FS ---
  list: publicProcedure.input(projectPathSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectFsService).list(input.context, input.path)
  ),
  readFile: publicProcedure.input(projectPathSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectFsService).readFile(input.context, input.path)
  ),
  writeFile: publicProcedure.input(projectWriteSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IProjectFsService).writeFile(input.context, input.path, input.content);
  }),
  stat: publicProcedure.input(projectPathSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectFsService).stat(input.context, input.path)
  ),
  findGitRoot: publicProcedure.input(projectPathSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectFsService).findGitRoot(input.context, input.path)
  ),

  // --- Git ---
  gitStatus: publicProcedure.input(projectContextSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectGitService).status(input)
  ),
  gitLog: publicProcedure.input(gitLogSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectGitService).log(input.context, {
      limit: input.limit,
      skip: input.skip,
    })
  ),
  gitDiff: publicProcedure.input(gitDiffSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectGitService).diff(input.context, {
      path: input.path,
      staged: input.staged,
      commit: input.commit,
    })
  ),
  gitBranches: publicProcedure.input(projectContextSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectGitService).branches(input)
  ),
  gitNumstat: publicProcedure.input(gitNumstatSchema).query(({ ctx, input }) =>
    ctx.injector.get(IProjectGitService).numstat(input.context, { commit: input.commit })
  ),
  gitCheckout: publicProcedure.input(gitCheckoutSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IProjectGitService).checkout(input.context, input.branch, {
      remote: input.remote,
    });
  }),
  gitStage: publicProcedure.input(gitPathsSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IProjectGitService).stage(input.context, input.paths);
  }),
  gitUnstage: publicProcedure.input(gitPathsSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IProjectGitService).unstage(input.context, input.paths);
  }),
  gitCommit: publicProcedure.input(gitCommitSchema).mutation(async ({ ctx, input }) => {
    await ctx.injector.get(IProjectGitService).commit(input.context, input.message);
  }),

  /**
   * `cd` signal for every tracked session. Session-agnostic on purpose: the
   * renderer filters by the active session, and duplicating this per transport
   * (ssh / pty) would deliver each change twice.
   */
  cwdChanged$: publicProcedure.subscription(async function* ({ ctx }) {
    yield* observableToAsyncGenerator(ctx.injector.get(ICommandBlockService).cwdChanged$);
  }),
});
