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

import type { Observable } from 'rxjs';
import type { AgentStatus, IChatMessage, ISendMessageOptions, ThinkingLevel } from '../models/agent';
import type { ICompactConfig, ICompactOptions } from '../models/compact';
import type { IAIAgentState } from '../models/state';
import { createIdentifier } from '@termlnk/core';

export interface IAIAgentService {
  readonly messages$: Observable<IChatMessage[]>;
  readonly isStreaming$: Observable<boolean>;
  readonly status$: Observable<AgentStatus>;
  readonly currentMessage$: Observable<IChatMessage | null>;
  readonly messageCompleted$: Observable<IChatMessage>;
  readonly state$: Observable<IAIAgentState>;
  readonly currentSessionId$: Observable<string | null>;
  readonly isCompacting$: Observable<boolean>;
  readonly pendingMessageIds$: Observable<string[]>;

  sendMessage(content: string, options?: ISendMessageOptions): Promise<void>;
  stopStreaming(): void;
  clearMessages(): void;
  abort(): void;
  reset(): void;
  setModel(provider: string, modelId: string): void;
  setSystemPrompt(prompt: string): void;
  setThinkingLevel(level: ThinkingLevel): void;
  setTools(tools: any[]): void;
  addTools(tools: any[]): void;
  removeTools(toolNames: string[]): void;
  setApiKey(provider: string, apiKey: string): void;

  loadSession(sessionId: string): Promise<void>;
  createNewSession(): Promise<string>;
  getCurrentSessionId(): string | null;

  /**
   * Restore the most recently accessed chat session as the current one.
   * Returns true on restore, false when no session exists in storage.
   * Idempotent: returns true immediately if a session is already current.
   */
  restoreLastSession(): Promise<boolean>;

  compactConversation(options: ICompactOptions): Promise<void>;
  setCompactConfig(config: ICompactConfig): void;

  cancelPending(messageId: string): Promise<void>;
  clearPendingQueue(): void;

  /**
   * Re-run inference from the assistant message identified by `messageId`.
   * Removes that message and everything after it, then prompts the agent again
   * with the conversation up to (but not including) the removed message.
   */
  retryMessage(messageId: string): Promise<void>;

  /**
   * Replace the content of the user message identified by `messageId`, drop
   * every message after it, and re-run inference with the edited prompt.
   */
  editUserMessage(messageId: string, content: string): Promise<void>;

  /**
   * Bypass-execute a registered agent tool (does not produce a chat message).
   * Used by widget-driven tool-call actions where the widget consumes the
   * result directly via postMessage. Returns the tool's structured result, or
   * throws when the tool is unknown or its execute() rejects.
   */
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

export const IAIAgentService = createIdentifier<IAIAgentService>('agent.ai-agent-service');
