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

import { IAIAgentService } from '@termlnk/agent';
import { ChatRepository } from '@termlnk/database';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { deleteSessionSchema, getMessagesSchema, getSessionSchema, loadSessionSchema, renameSessionSchema, setSessionSelectedSkillsSchema, setSessionSelectedToolsSchema } from '../schema/chat.schema';
import { publicProcedure, router } from '../trpc';

export type ChatRouter = typeof chatRouter;

export const chatRouter = router({
  // --- Queries ---

  listSessions: publicProcedure
    .query(async ({ ctx }) => {
      const repo = ctx.injector.get(ChatRepository);
      return repo.listSessions();
    }),

  getSession: publicProcedure
    .input(getSessionSchema)
    .query(async ({ ctx, input }) => {
      const repo = ctx.injector.get(ChatRepository);
      return repo.getSession(input.sessionId);
    }),

  getMessages: publicProcedure
    .input(getMessagesSchema)
    .query(async ({ ctx, input }) => {
      const repo = ctx.injector.get(ChatRepository);
      return repo.getMessages(input.sessionId);
    }),

  // --- Mutations ---

  deleteSession: publicProcedure
    .input(deleteSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = ctx.injector.get(ChatRepository);
      await repo.deleteSession(input.sessionId);
    }),

  renameSession: publicProcedure
    .input(renameSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = ctx.injector.get(ChatRepository);
      await repo.renameSession(input.sessionId, input.title);
    }),

  setSelectedSkills: publicProcedure
    .input(setSessionSelectedSkillsSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = ctx.injector.get(ChatRepository);
      await repo.updateSession(input.sessionId, {
        selectedSkillIds: [...new Set(input.skillIds)],
      });
    }),

  setSelectedTools: publicProcedure
    .input(setSessionSelectedToolsSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = ctx.injector.get(ChatRepository);
      await repo.updateSession(input.sessionId, {
        selectedToolIds: input.toolIds ? [...new Set(input.toolIds)] : null,
      });
    }),

  loadSession: publicProcedure
    .input(loadSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      await service.loadSession(input.sessionId);
    }),

  newSession: publicProcedure
    .mutation(async ({ ctx }) => {
      const service = ctx.injector.get(IAIAgentService);
      return service.createNewSession();
    }),

  // --- Subscriptions ---

  sessions$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const repo = ctx.injector.get(ChatRepository);
      yield* observableToAsyncGenerator(repo.changed$);
    }),

  currentSessionId$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAIAgentService);
      yield* observableToAsyncGenerator(service.currentSessionId$);
    }),
});
