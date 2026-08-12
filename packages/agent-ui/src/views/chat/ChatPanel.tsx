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

import { useDependency } from '@termlnk/design';
import { IAIAgentMessagingService, IChatSessionService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBuiltinConversationSource } from './builtin-conversation-source';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ChatSessionList } from './ChatSessionList';
import { ConversationContext } from './conversation-context';
import { PendingApprovalBar } from './PendingApprovalBar';

function useSessionTitle(): string | undefined {
  const chatSessionService = useDependency(IChatSessionService);
  const [title, setTitle] = useState<string | undefined>();
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchTitle = async (sessionId: string | null) => {
      if (!sessionId) {
        setTitle(undefined);
        return;
      }
      try {
        const session = await chatSessionService.getSession(sessionId);
        setTitle(session?.title ?? undefined);
      } catch {
        setTitle(undefined);
      }
    };

    const sub = chatSessionService.currentSessionId$.subscribe((sessionId) => {
      currentSessionIdRef.current = sessionId;
      fetchTitle(sessionId);
    });

    const sessionSub = chatSessionService.sessions$.subscribe((event) => {
      if (event.type === 'update' && event.sessionId === currentSessionIdRef.current) {
        fetchTitle(currentSessionIdRef.current);
      }
    });

    return () => {
      sub.unsubscribe();
      sessionSub.unsubscribe();
    };
  }, [chatSessionService]);

  return title;
}

export function ChatPanel() {
  const messaging = useDependency(IAIAgentMessagingService);
  const conversation = useMemo(() => createBuiltinConversationSource(messaging), [messaging]);
  const [showHistory, setShowHistory] = useState(false);
  const sessionTitle = useSessionTitle();

  const handleToggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  const handleSelectSession = useCallback(() => {
    setShowHistory(false);
  }, []);

  return (
    <ConversationContext.Provider value={conversation}>
      <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:overflow-hidden tm:bg-black">
        <ChatHeader showHistory={showHistory} onToggleHistory={handleToggleHistory} sessionTitle={sessionTitle} />
        {showHistory
          ? <ChatSessionList onSelectSession={handleSelectSession} />
          : (
            <>
              <ChatMessages />
              <PendingApprovalBar />
              <ChatInput />
            </>
          )}
      </div>
    </ConversationContext.Provider>
  );
}
