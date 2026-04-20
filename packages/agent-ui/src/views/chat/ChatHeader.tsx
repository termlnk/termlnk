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

import { LocaleService } from '@termlnk/core';
import { Button, useDependency } from '@termlnk/design';
import { IAIAgentClientService, IChatSessionClientService } from '@termlnk/rpc-client';
import { ResizableService } from '@termlnk/ui';
import { ArrowLeft, History, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useMemo } from 'react';

interface IChatHeaderProps {
  showHistory: boolean;
  onToggleHistory: () => void;
  sessionTitle?: string;
}

export function ChatHeader({ showHistory, onToggleHistory, sessionTitle }: IChatHeaderProps) {
  const aiAgentService = useDependency(IAIAgentClientService);
  const chatSessionService = useDependency(IChatSessionClientService);
  const resizableService = useDependency(ResizableService);
  const localeService = useDependency(LocaleService);

  const headerTitle = useMemo(() => {
    if (showHistory) {
      return localeService.t('agent-ui.chat.history');
    }
    if (sessionTitle && sessionTitle !== 'New Chat') {
      return sessionTitle;
    }
    return localeService.t('agent-ui.chat.title');
  }, [showHistory, sessionTitle, localeService]);

  const handleClear = useCallback(() => {
    aiAgentService.clearMessages();
  }, [aiAgentService]);

  const handleNewChat = useCallback(() => {
    chatSessionService.newSession();
  }, [chatSessionService]);

  const handleClose = useCallback(() => {
    resizableService.collapse('right');
  }, [resizableService]);

  return (
    <div className="tm:flex tm:h-9 tm:shrink-0 tm:items-center tm:border-b tm:border-line tm:bg-black tm:px-2">
      <span className="tm:flex-1 tm:truncate tm:pl-1 tm:text-xs tm:font-medium tm:text-white">
        {headerTitle}
      </span>
      <div className="tm:flex tm:items-center tm:gap-0.5 tm:select-none">
        {showHistory
          ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onToggleHistory}
              title={localeService.t('agent-ui.chat.back-to-chat')}
            >
              <ArrowLeft size={14} />
            </Button>
          )
          : (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleNewChat}
                title={localeService.t('agent-ui.chat.new-chat')}
              >
                <Plus size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onToggleHistory}
                title={localeService.t('agent-ui.chat.history')}
              >
                <History size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleClear}
                title={localeService.t('agent-ui.chat.clear')}
              >
                <Trash2 size={14} />
              </Button>
            </>
          )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleClose}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
