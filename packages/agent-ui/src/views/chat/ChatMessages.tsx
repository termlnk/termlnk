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

import type { IChatMessage, IMessagePart } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { useDependency, useObservable } from '@termlnk/design';
import { IAIAgentClientService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { map } from 'rxjs';
import { ChatMessageBubble } from './ChatMessageBubble';
import { DotmatrixLoader } from './components/DotmatrixLoader';
import { ThinkingIndicator } from './components/ThinkingIndicator';

function hasVisibleStreamingContent(parts: IMessagePart[]): boolean {
  return parts.some((p) => {
    if (p.type === 'text') {
      return p.text.trim().length > 0;
    }
    return p.type === 'tool' || p.type === 'image';
  });
}

export function ChatMessages() {
  const aiAgentService = useDependency(IAIAgentClientService);
  const localeService = useDependency(LocaleService);
  const messages = useObservable(aiAgentService.messages$, []);
  const currentMessage = useObservable(aiAgentService.currentMessage$, null);
  const pendingMessageIds = useObservable(aiAgentService.pendingMessageIds$, []);
  const pendingIdSet = useMemo(() => new Set(pendingMessageIds), [pendingMessageIds]);
  const isStreaming = useObservable(
    useMemo(
      () => aiAgentService.status$.pipe(map((s) => s === 'streaming' || s === 'thinking' || s === 'tool_calling')),
      [aiAgentService]
    ),
    false
  );
  const isCompacting = useObservable(aiAgentService.isCompacting$, false);

  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      setStreamStartedAt((prev) => prev ?? Date.now());
    } else {
      setStreamStartedAt(null);
    }
  }, [isStreaming]);

  const handleCancelPending = useCallback((messageId: string) => {
    aiAgentService.cancelPending(messageId).catch((err) => {
      console.error('[ChatMessages] cancelPending failed:', err);
    });
  }, [aiAgentService]);

  const handleStop = useCallback(() => {
    aiAgentService.stopStreaming();
  }, [aiAgentService]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const allMessages: IChatMessage[] = useMemo(() => {
    const visible = messages.filter((m) => !m.hiddenInUI);
    if (currentMessage) {
      return [...visible, currentMessage];
    }
    return visible;
  }, [messages, currentMessage]);

  const showThinkingIndicator = isStreaming
    && streamStartedAt !== null
    && !(currentMessage && hasVisibleStreamingContent(currentMessage.parts));

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && shouldAutoScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll on content resize (handles typewriter animation height changes)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => scrollToBottom());
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [allMessages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    shouldAutoScrollRef.current = atBottom;
  }, []);

  return (
    <div
      ref={scrollRef}
      className="tm:min-w-0 tm:flex-1 tm:overflow-y-auto tm:p-3"
      onScroll={handleScroll}
    >
      {allMessages.length === 0
        ? (
          <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:text-xs tm:text-grey">
            <span>Start a conversation</span>
          </div>
        )
        : (
          <div ref={contentRef} className="tm:flex tm:flex-col tm:gap-3">
            {allMessages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isPending={pendingIdSet.has(msg.id)}
                onCancelPending={handleCancelPending}
              />
            ))}
          </div>
        )}
      {showThinkingIndicator && streamStartedAt !== null && (
        <ThinkingIndicator startedAt={streamStartedAt} onStop={handleStop} />
      )}
      {isCompacting && (
        <div className="tm:mt-3 tm:flex tm:items-center tm:gap-2 tm:text-xs tm:text-blue">
          <DotmatrixLoader size={5} cellPx={3} gapPx={1} pattern="wave" />
          <span>{localeService.t('agent-ui.chat.compacting')}</span>
        </div>
      )}
    </div>
  );
}
