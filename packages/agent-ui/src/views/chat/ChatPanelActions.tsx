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

import { Button, useDependency, useObservable } from '@termlnk/design';
import { IAIAgentMessagingService, IChatSessionService } from '@termlnk/rpc-client';
import { TooltipWrapper } from '@termlnk/ui';
import { ArrowLeft, History, Plus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { IChatPanelViewService } from '../../services/chat-panel-view.service';

/**
 * Chat-specific buttons for the side-panel tab bar. Registered as the panel's
 * `actions` so the panel body itself needs no title bar.
 */
export function ChatPanelActions() {
  const aiAgentService = useDependency(IAIAgentMessagingService);
  const chatSessionService = useDependency(IChatSessionService);
  const view = useDependency(IChatPanelViewService);
  const showHistory = useObservable(view.showHistory$, false);

  const handleToggleHistory = useCallback(() => {
    view.toggleHistory();
  }, [view]);

  const handleNewChat = useCallback(() => {
    chatSessionService.newSession();
  }, [chatSessionService]);

  const handleClear = useCallback(() => {
    aiAgentService.clearMessages();
  }, [aiAgentService]);

  if (showHistory) {
    return (
      <TooltipWrapper side="bottom" labelKey="agent-ui.chat.back-to-chat">
        <Button variant="ghost" size="icon-xs" onClick={handleToggleHistory}>
          <ArrowLeft size={14} />
        </Button>
      </TooltipWrapper>
    );
  }

  return (
    <>
      <TooltipWrapper side="bottom" labelKey="agent-ui.chat.new-chat">
        <Button variant="ghost" size="icon-xs" onClick={handleNewChat}>
          <Plus size={14} />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper side="bottom" labelKey="agent-ui.chat.history">
        <Button variant="ghost" size="icon-xs" onClick={handleToggleHistory}>
          <History size={14} />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper side="bottom" labelKey="agent-ui.chat.clear">
        <Button variant="ghost" size="icon-xs" onClick={handleClear}>
          <Trash2 size={14} />
        </Button>
      </TooltipWrapper>
    </>
  );
}
