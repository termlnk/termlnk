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

import type { IChatMessage, IChatToolCall } from '@termlnk/agent';
import type { ReactElement } from 'react';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { AlertCircle, ChevronDown, Hourglass, Loader2, Wrench, X } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { ChatCompactBoundary } from './ChatCompactBoundary';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useTypewriter } from './use-typewriter';

interface IChatMessageBubbleProps {
  message: IChatMessage;
  isPending?: boolean;
  onCancelPending?: (messageId: string) => void;
}

function getToolCallStatusIcon(status: IChatToolCall['status']): ReactElement {
  switch (status) {
    case 'running':
      return <Loader2 size={12} className="tm:animate-spin tm:text-blue" />;
    case 'error':
      return <AlertCircle size={12} className="tm:text-red" />;
    default:
      return <Wrench size={12} className="tm:text-green" />;
  }
}

function ToolCallItem({ toolCall }: { toolCall: IChatToolCall }) {
  const statusIcon = getToolCallStatusIcon(toolCall.status);

  return (
    <div
      className="
        tm:flex tm:items-center tm:gap-1.5 tm:rounded-sm tm:bg-one-bg tm:px-2 tm:py-1 tm:text-xs tm:text-grey-fg
      "
    >
      {statusIcon}
      <span className="tm:truncate">{toolCall.name}</span>
      {toolCall.error && (
        <span className="tm:ml-1 tm:truncate tm:text-red">{toolCall.error}</span>
      )}
    </div>
  );
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tm:mb-1.5">
      <button
        type="button"
        className="
          tm:flex tm:items-center tm:gap-1 tm:text-xs tm:text-grey
          tm:hover:text-grey-fg
        "
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown
          size={12}
          className={cn('tm:transition-transform tm:duration-150', expanded && 'tm:rotate-180')}
        />
        <span>Thinking</span>
      </button>
      {expanded && (
        <div className="tm:mt-1 tm:rounded-sm tm:bg-one-bg tm:p-2 tm:text-xs/relaxed tm:text-grey-fg">
          {thinking}
        </div>
      )}
    </div>
  );
}

export const ChatMessageBubble = memo(function ChatMessageBubble({ message, isPending, onCancelPending }: IChatMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = !!message.error;
  const displayedContent = useTypewriter(message.content, !!message.isStreaming);
  const localeService = useDependency(LocaleService);

  const handleCancel = useCallback(() => {
    onCancelPending?.(message.id);
  }, [message.id, onCancelPending]);

  if (message.role === 'compact_boundary') {
    return <ChatCompactBoundary message={message} />;
  }

  if (isUser) {
    return (
      <div className="tm:flex tm:flex-col tm:items-end tm:gap-1">
        <div
          className={cn(
            `
              tm:max-w-[85%] tm:rounded-xl tm:rounded-br-sm tm:px-3 tm:py-2 tm:text-sm tm:text-white
              tm:transition-colors
            `,
            {
              'tm:bg-one-bg2': !isPending,
              'tm:bg-one-bg tm:opacity-80 tm:ring-1 tm:ring-blue/40': isPending,
            }
          )}
        >
          {message.images && message.images.length > 0 && (
            <div className="tm:mb-2 tm:flex tm:flex-wrap tm:gap-1.5">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt=""
                  className="tm:max-h-32 tm:max-w-full tm:rounded-sm tm:object-contain"
                />
              ))}
            </div>
          )}
          <p className="tm:wrap-break-word tm:whitespace-pre-wrap">{message.content}</p>
        </div>
        {isPending && (
          <div className="tm:flex tm:items-center tm:gap-1 tm:text-[0.68rem] tm:text-blue">
            <Hourglass size={10} className="tm:animate-pulse" />
            <span>{localeService.t('agent-ui.chat.pending-queued')}</span>
            <button
              type="button"
              onClick={handleCancel}
              className={`
                tm:ml-1 tm:flex tm:items-center tm:gap-0.5 tm:rounded-sm tm:bg-one-bg tm:px-1.5 tm:py-0.5
                tm:text-[0.66rem] tm:text-grey-fg tm:transition-colors
                tm:hover:bg-one-bg2 tm:hover:text-white
              `}
              title={localeService.t('agent-ui.chat.pending-cancel')}
            >
              <X size={10} />
              <span>{localeService.t('agent-ui.chat.pending-cancel')}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tm:flex tm:min-w-0 tm:justify-start">
      <div className="tm:max-w-[95%] tm:min-w-0">
        {message.thinking && <ThinkingBlock thinking={message.thinking} />}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="tm:mb-1.5 tm:flex tm:flex-col tm:gap-1">
            {message.toolCalls.map((tc) => <ToolCallItem key={tc.id} toolCall={tc} />)}
          </div>
        )}
        {isError
          ? (
            <div
              className="tm:rounded-lg tm:border tm:border-red/20 tm:bg-red/5 tm:px-3 tm:py-2 tm:text-sm tm:text-red"
            >
              {message.error}
            </div>
          )
          : (
            <div className="tm:text-white">
              <MarkdownRenderer content={displayedContent} />
              {message.isStreaming && (
                <span className="tm:inline-block tm:h-4 tm:w-1.5 tm:animate-pulse tm:rounded-xs tm:bg-blue" />
              )}
            </div>
          )}
      </div>
    </div>
  );
});
