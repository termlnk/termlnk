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

import { useDependency, useObservable } from '@termlnk/design';
import { IAIAgentMessagingService } from '@termlnk/rpc-client';
import { useCallback, useMemo } from 'react';
import { IChatPanelViewService } from '../../services/chat-panel-view.service';
import { createBuiltinConversationSource } from './builtin-conversation-source';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ChatSessionList } from './ChatSessionList';
import { ConversationContext } from './conversation-context';
import { PendingApprovalBar } from './PendingApprovalBar';

export function ChatPanel() {
  const messaging = useDependency(IAIAgentMessagingService);
  const view = useDependency(IChatPanelViewService);
  const conversation = useMemo(() => createBuiltinConversationSource(messaging), [messaging]);
  const showHistory = useObservable(view.showHistory$, false);

  const handleSelectSession = useCallback(() => {
    view.setShowHistory(false);
  }, [view]);

  return (
    <ConversationContext.Provider value={conversation}>
      <div className="tm:flex tm:h-full tm:min-w-0 tm:flex-col tm:overflow-hidden tm:bg-black">
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
