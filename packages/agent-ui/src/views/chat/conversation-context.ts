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

import type { AgentStatus, IChatMessage } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { createContext, useContext } from 'react';

/**
 * The data surface message rendering needs, independent of which engine
 * produced the conversation and of how many conversations are live at once.
 *
 * `IAIAgentMessagingService` is a process-wide singleton with an implicit
 * "current session"; ACP runs one conversation per tab. This interface is what
 * both can satisfy.
 *
 * Every member is required: an adapter that lacks a concept supplies a constant
 * stream for it. Optional members would push per-render fallbacks
 * (`x$ ?? of([])`) into consumers, and a fresh Observable each render
 * re-subscribes on every commit.
 */
export interface IConversationSource {
  readonly messages$: Observable<IChatMessage[]>;
  readonly currentMessage$: Observable<IChatMessage | null>;
  /** Engine status; ACP maps its session status onto the coarse equivalent. */
  readonly status$: Observable<AgentStatus>;
  readonly pendingMessageIds$: Observable<string[]>;
  readonly isCompacting$: Observable<boolean>;

  cancelPending(messageId: string): Promise<void>;
  stopStreaming(): Promise<void>;
}

export const ConversationContext = createContext<IConversationSource | null>(null);

export function useConversationSource(): IConversationSource {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    throw new Error(
      'useConversationSource() requires a ConversationContext provider. '
      + 'Wrap the chat tree with <ConversationContext.Provider>.'
    );
  }
  return ctx;
}
