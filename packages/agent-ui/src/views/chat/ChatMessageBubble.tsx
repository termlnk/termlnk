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

import type { IChatMessage } from '@termlnk/agent';
import { memo, useCallback } from 'react';
import { ChatCompactBoundary } from './ChatCompactBoundary';
import { AssistantMessageBubble } from './components/AssistantMessageBubble';
import { UserMessageBubble } from './components/UserMessageBubble';

interface IChatMessageBubbleProps {
  message: IChatMessage;
  isPending?: boolean;
  onCancelPending?: (messageId: string) => void;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({ message, isPending, onCancelPending }: IChatMessageBubbleProps) {
  const handleCancel = useCallback(() => {
    onCancelPending?.(message.id);
  }, [message.id, onCancelPending]);

  if (message.role === 'compact_boundary') {
    return <ChatCompactBoundary message={message} />;
  }

  if (message.role === 'user') {
    return (
      <UserMessageBubble
        message={message}
        isPending={!!isPending}
        onCancelPending={handleCancel}
      />
    );
  }

  return <AssistantMessageBubble message={message} />;
});
