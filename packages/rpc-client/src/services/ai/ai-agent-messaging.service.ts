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

import type { AgentStatus, IAIAgentState, IChatMessage, ICompactOptions, ISendMessageOptions, ITerminalSuggestion, ITerminalSuggestionPhaseEvent, ThinkingLevel } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { map, shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

export interface IAIAgentClientService {
  readonly messages$: Observable<IChatMessage[]>;
  readonly isStreaming$: Observable<boolean>;
  readonly status$: Observable<AgentStatus>;
  readonly currentMessage$: Observable<IChatMessage | null>;
  readonly messageCompleted$: Observable<IChatMessage>;
  readonly state$: Observable<IAIAgentState>;
  readonly isCompacting$: Observable<boolean>;
  readonly pendingMessageIds$: Observable<string[]>;
  /** Phase events for inline terminal suggestions (pending / cleared). */
  readonly terminalSuggestionPhase$: Observable<ITerminalSuggestionPhaseEvent>;
  /** Suggestion completion events (NL2Cmd dispatch + errorFix notice). */
  readonly terminalSuggestion$: Observable<ITerminalSuggestion>;

  sendMessage(content: string, options?: ISendMessageOptions): Promise<void>;
  cancelPending(messageId: string): Promise<void>;
  clearPendingQueue(): Promise<void>;
  stopStreaming(): Promise<void>;
  clearMessages(): Promise<void>;
  abort(): Promise<void>;
  reset(): Promise<void>;
  retryMessage(messageId: string): Promise<void>;
  editUserMessage(messageId: string, content: string): Promise<void>;
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  setModel(provider: string, modelId: string): Promise<void>;
  setSystemPrompt(prompt: string): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): Promise<void>;
  setApiKey(provider: string, apiKey: string): Promise<void>;
  compactConversation(options: ICompactOptions): Promise<void>;
  /** Cancel any in-flight inline-suggestion request for the given session. */
  cancelTerminalSuggestion(sessionId: string): Promise<void>;
  /** Apply the last error-fix suggestion for the session. Returns false if nothing is queued. */
  applyTerminalErrorFix(sessionId: string): Promise<boolean>;
}

export const IAIAgentClientService = createIdentifier<IAIAgentClientService>('rpc-client.ai-agent-client-service');

export class AIAgentClientService extends Disposable implements IAIAgentClientService {
  private readonly _state$: Observable<IAIAgentState>;

  readonly messages$: Observable<IChatMessage[]>;
  readonly isStreaming$: Observable<boolean>;
  readonly status$: Observable<AgentStatus>;
  readonly currentMessage$: Observable<IChatMessage | null>;
  readonly messageCompleted$: Observable<IChatMessage>;
  readonly state$: Observable<IAIAgentState>;
  readonly isCompacting$: Observable<boolean>;
  readonly pendingMessageIds$: Observable<string[]>;
  readonly terminalSuggestionPhase$: Observable<ITerminalSuggestionPhaseEvent>;
  readonly terminalSuggestion$: Observable<ITerminalSuggestion>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();

    this._state$ = trpcSubscriptionToObservable<IAIAgentState>((opts) =>
      this.client.state$.subscribe(undefined, opts)
    ).pipe(
      shareReplay(1)
    );

    this.state$ = this._state$;
    this.messages$ = this._state$.pipe(map((s) => s.messages));
    this.isStreaming$ = this._state$.pipe(map((s) => s.isStreaming));
    this.status$ = this._state$.pipe(map((s) => s.status));
    this.currentMessage$ = this._state$.pipe(map((s) => s.currentMessage));
    this.pendingMessageIds$ = this._state$.pipe(map((s) => s.pendingMessageIds));

    this.messageCompleted$ = trpcSubscriptionToObservable<IChatMessage>((opts) =>
      this.client.messageCompleted$.subscribe(undefined, opts)
    );

    this.isCompacting$ = trpcSubscriptionToObservable<boolean>((opts) =>
      this.client.isCompacting$.subscribe(undefined, opts)
    ).pipe(shareReplay(1));

    this.terminalSuggestionPhase$ = trpcSubscriptionToObservable<ITerminalSuggestionPhaseEvent>((opts) =>
      this.client.terminalSuggestionPhase$.subscribe(undefined, opts)
    );

    this.terminalSuggestion$ = trpcSubscriptionToObservable<ITerminalSuggestion>((opts) =>
      this.client.terminalSuggestion$.subscribe(undefined, opts)
    );
  }

  private get client() {
    return this._rpcClientService.getClient().ai;
  }

  async sendMessage(content: string, options?: ISendMessageOptions): Promise<void> {
    await this.client.sendMessage.mutate({
      content,
      images: options?.images,
      deliverAs: options?.deliverAs,
    });
  }

  async cancelPending(messageId: string): Promise<void> {
    await this.client.cancelPending.mutate({ messageId });
  }

  async retryMessage(messageId: string): Promise<void> {
    await this.client.retryMessage.mutate({ messageId });
  }

  async editUserMessage(messageId: string, content: string): Promise<void> {
    await this.client.editUserMessage.mutate({ messageId, content });
  }

  async invokeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.client.invokeTool.mutate({ toolName, args });
  }

  async clearPendingQueue(): Promise<void> {
    await this.client.clearPendingQueue.mutate();
  }

  async stopStreaming(): Promise<void> {
    await this.client.stopStreaming.mutate();
  }

  async clearMessages(): Promise<void> {
    await this.client.clearMessages.mutate();
  }

  async abort(): Promise<void> {
    await this.client.abort.mutate();
  }

  async reset(): Promise<void> {
    await this.client.reset.mutate();
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    await this.client.setModel.mutate({ provider, modelId });
  }

  async setSystemPrompt(prompt: string): Promise<void> {
    await this.client.setSystemPrompt.mutate({ prompt });
  }

  async setThinkingLevel(level: ThinkingLevel): Promise<void> {
    await this.client.setThinkingLevel.mutate({ level });
  }

  async setApiKey(provider: string, apiKey: string): Promise<void> {
    await this.client.setApiKey.mutate({ provider, apiKey });
  }

  async compactConversation(options: ICompactOptions): Promise<void> {
    await this.client.compactConversation.mutate(options);
  }

  async cancelTerminalSuggestion(sessionId: string): Promise<void> {
    await this.client.cancelTerminalSuggestion.mutate({ sessionId });
  }

  async applyTerminalErrorFix(sessionId: string): Promise<boolean> {
    return this.client.applyTerminalErrorFix.mutate({ sessionId });
  }
}
