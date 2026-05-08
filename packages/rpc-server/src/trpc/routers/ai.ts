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

import { IAIAgentService, ILLMProviderService, ITerminalSuggestService } from '@termlnk/agent';
import { observableToAsyncGenerator } from '@termlnk/rpc';
import { map } from 'rxjs/operators';
import { sanitizeProviderUserConfig } from '../../common/sanitize-secrets';
import { addCustomModelSchema, addProviderSchema, applyTerminalErrorFixSchema, cancelPendingSchema, cancelTerminalSuggestionSchema, compactConversationSchema, editUserMessageSchema, getProviderConfigSchema, invokeToolSchema, refreshProviderModelsSchema, removeCustomModelSchema, removeProviderSchema, resetModelOverridesSchema, retryMessageSchema, sendMessageSchema, setActiveModelSchema, setApiKeySchema, setModelSchema, setSystemPromptSchema, setThinkingLevelSchema, testProviderModelSchema, toggleModelSchema, updateModelOverridesSchema, updateProviderConfigSchema } from '../schema/ai.schema';
import { publicProcedure, router } from '../trpc';

export type AIRouter = typeof aiRouter;

export const aiRouter = router({
  // --- Agent mutations ---

  sendMessage: publicProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      await service.sendMessage(input.content, {
        images: input.images,
        deliverAs: input.deliverAs,
      });
    }),

  cancelPending: publicProcedure
    .input(cancelPendingSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      await service.cancelPending(input.messageId);
    }),

  retryMessage: publicProcedure
    .input(retryMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      await service.retryMessage(input.messageId);
    }),

  editUserMessage: publicProcedure
    .input(editUserMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      await service.editUserMessage(input.messageId, input.content);
    }),

  invokeTool: publicProcedure
    .input(invokeToolSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      return service.invokeTool(input.toolName, input.args);
    }),

  clearPendingQueue: publicProcedure
    .mutation(async ({ ctx }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.clearPendingQueue();
    }),

  stopStreaming: publicProcedure
    .mutation(async ({ ctx }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.stopStreaming();
    }),

  abort: publicProcedure
    .mutation(async ({ ctx }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.abort();
    }),

  clearMessages: publicProcedure
    .mutation(async ({ ctx }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.clearMessages();
    }),

  reset: publicProcedure
    .mutation(async ({ ctx }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.reset();
    }),

  compactConversation: publicProcedure
    .input(compactConversationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      await service.compactConversation(input);
    }),

  setModel: publicProcedure
    .input(setModelSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.setModel(input.provider, input.modelId);
    }),

  setApiKey: publicProcedure
    .input(setApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.setApiKey(input.provider, input.apiKey);
    }),

  setSystemPrompt: publicProcedure
    .input(setSystemPromptSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.setSystemPrompt(input.prompt);
    }),

  setThinkingLevel: publicProcedure
    .input(setThinkingLevelSchema)
    .mutation(async ({ ctx, input }) => {
      const service = ctx.injector.get(IAIAgentService);
      service.setThinkingLevel(input.level);
    }),

  // --- Provider mutations ---

  setActiveModel: publicProcedure
    .input(setActiveModelSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      providerService.setActiveModel(input.modelId);
    }),

  addProvider: publicProcedure
    .input(addProviderSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.addProvider(input);
    }),

  removeProvider: publicProcedure
    .input(removeProviderSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.removeProvider(input.providerId);
    }),

  updateProviderConfig: publicProcedure
    .input(updateProviderConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.updateProviderConfig(input.providerId, input.patch);
    }),

  refreshProviderModels: publicProcedure
    .input(refreshProviderModelsSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      return providerService.refreshProviderModels(input.providerId);
    }),

  testProviderModel: publicProcedure
    .input(testProviderModelSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      return providerService.testProviderModel(input.providerId, input.modelId);
    }),

  // --- Model mutations ---

  toggleModel: publicProcedure
    .input(toggleModelSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.toggleModel(input.providerId, input.modelId, input.enabled);
    }),

  updateModelOverrides: publicProcedure
    .input(updateModelOverridesSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.updateModelOverrides(input.providerId, input.modelId, input.overrides);
    }),

  resetModelOverrides: publicProcedure
    .input(resetModelOverridesSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.resetModelOverrides(input.providerId, input.modelId);
    }),

  // --- Custom model mutations ---

  addCustomModel: publicProcedure
    .input(addCustomModelSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.addCustomModel(input.providerId, input.model);
    }),

  removeCustomModel: publicProcedure
    .input(removeCustomModelSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      await providerService.removeCustomModel(input.providerId, input.modelId);
    }),

  // --- Queries ---

  getProviders: publicProcedure
    .query(async ({ ctx }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      return providerService.getProviders();
    }),

  getActiveModel: publicProcedure
    .query(async ({ ctx }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      return providerService.getActiveModel();
    }),

  getProviderConfig: publicProcedure
    .input(getProviderConfigSchema)
    .query(async ({ ctx, input }) => {
      const providerService = ctx.injector.get(ILLMProviderService);
      return sanitizeProviderUserConfig(providerService.getProviderConfig(input.providerId));
    }),

  // --- Subscriptions ---

  state$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAIAgentService);
      yield* observableToAsyncGenerator(service.state$);
    }),

  messageCompleted$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAIAgentService);
      yield* observableToAsyncGenerator(service.messageCompleted$);
    }),

  providers$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const providerService = ctx.injector.get(ILLMProviderService);
      yield* observableToAsyncGenerator(providerService.providers$);
    }),

  activeModel$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const providerService = ctx.injector.get(ILLMProviderService);
      yield* observableToAsyncGenerator(providerService.activeModel$);
    }),

  activeModelId$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const providerService = ctx.injector.get(ILLMProviderService);
      yield* observableToAsyncGenerator(providerService.activeModelId$);
    }),

  activeProvider$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const providerService = ctx.injector.get(ILLMProviderService);
      yield* observableToAsyncGenerator(
        providerService.activeProvider$.pipe(map((c) => sanitizeProviderUserConfig(c)))
      );
    }),

  isCompacting$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const service = ctx.injector.get(IAIAgentService);
      yield* observableToAsyncGenerator(service.isCompacting$);
    }),

  // --- Terminal inline suggestions ---

  cancelTerminalSuggestion: publicProcedure
    .input(cancelTerminalSuggestionSchema)
    .mutation(({ ctx, input }) => {
      const suggest = ctx.injector.get(ITerminalSuggestService);
      suggest.cancelInflight(input.sessionId);
    }),

  /**
   * Apply the last error-fix suggestion for a session. Returns whether a
   * suggestion was queued — false means "nothing to apply" so the renderer
   * can surface a hint instead of silently doing nothing.
   */
  applyTerminalErrorFix: publicProcedure
    .input(applyTerminalErrorFixSchema)
    .mutation(({ ctx, input }) => {
      const suggest = ctx.injector.get(ITerminalSuggestService);
      return suggest.applyLastErrorFix(input.sessionId);
    }),

  /**
   * Phase events for inline terminal suggestions (pending / cleared) that
   * drive the renderer-side spinner. Carries `requestId` so consumers can
   * match pending↔cleared even when requests are superseded mid-flight.
   */
  terminalSuggestionPhase$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const suggest = ctx.injector.get(ITerminalSuggestService);
      yield* observableToAsyncGenerator(suggest.phase$);
    }),

  /** Suggestion completion events — surfaces error-fix notices to the renderer. */
  terminalSuggestion$: publicProcedure
    .subscription(async function* ({ ctx }) {
      const suggest = ctx.injector.get(ITerminalSuggestService);
      yield* observableToAsyncGenerator(suggest.suggestion$);
    }),
});
