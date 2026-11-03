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

import type { IAIAgentMessagingService } from '@termlnk/rpc-client';
import type { IConversationSource } from './conversation-context';

/** Adapts the process-wide built-in agent messaging facade into IConversationSource. */
export function createBuiltinConversationSource(
  messaging: IAIAgentMessagingService
): IConversationSource {
  return {
    messages$: messaging.messages$,
    currentMessage$: messaging.currentMessage$,
    status$: messaging.status$,
    pendingMessageIds$: messaging.pendingMessageIds$,
    isCompacting$: messaging.isCompacting$,
    cancelPending: (messageId) => messaging.cancelPending(messageId),
    stopStreaming: () => messaging.stopStreaming(),
  };
}
