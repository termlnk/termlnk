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

import type { IChatMessage, IMessagePart, ITextPart, IToolPart } from '@termlnk/agent';
import type { ReactNode } from 'react';
import { ICommandService, LocaleService } from '@termlnk/core';
import { useDependency } from '@termlnk/design';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { RetryMessageCommand } from '../../../commands/retry-message.command';
import { IGenerativeUIRegistryService } from '../../../services/generative-ui/generative-ui-registry.service';
import { ErrorPart } from '../parts/ErrorPart';
import { GenerativeUiBlock } from '../parts/GenerativeUiBlock';
import { ImagePart } from '../parts/ImagePart';
import { TextPart } from '../parts/TextPart';
import { ThinkingPart } from '../parts/ThinkingPart';
import { ToolPartGroup } from '../parts/ToolPartGroup';
import { MessageActions } from './MessageActions';

interface IAssistantMessageBubbleProps {
  message: IChatMessage;
}

interface IRenderGroup {
  kind: 'tool' | 'other';
  parts: Array<{ part: IMessagePart; index: number }>;
}

function groupParts(parts: IMessagePart[]): IRenderGroup[] {
  const groups: IRenderGroup[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const kind: IRenderGroup['kind'] = part.type === 'tool' ? 'tool' : 'other';
    const last = groups.at(-1);
    if (last && last.kind === kind) {
      last.parts.push({ part, index: i });
    } else {
      groups.push({ kind, parts: [{ part, index: i }] });
    }
  }
  return groups;
}

function getLastTextPartIndex(parts: IMessagePart[]): number {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i].type === 'text') {
      return i;
    }
  }
  return -1;
}

function getCopyText(parts: IMessagePart[]): string {
  return parts
    .filter((p): p is ITextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n');
}

// Copy / Retry / elapsed meta only make sense when the message produced an
// actual reply (text, image, or error). Pure tool-call messages are
// intermediate steps; surfacing those affordances there would be misleading.
// Error parts count as a terminal output: the user must be able to retry
// after a failed request even though there is nothing useful to copy.
function hasAuthoredOutput(parts: IMessagePart[], copyText: string): boolean {
  return copyText.trim().length > 0 || parts.some((p) => p.type === 'image' || p.type === 'error');
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) {
    return `${s}s`;
  }
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
}

function formatTokens(n: number): string {
  if (n < 1000) {
    return String(n);
  }
  return `${(n / 1000).toFixed(1)}k`;
}

export const AssistantMessageBubble = memo(function AssistantMessageBubble({ message }: IAssistantMessageBubbleProps) {
  const commandService = useDependency(ICommandService);
  const generativeUIRegistry = useDependency(IGenerativeUIRegistryService);
  const localeService = useDependency(LocaleService);

  const handleRetry = useCallback(() => {
    commandService.executeCommand(RetryMessageCommand.id, { messageId: message.id });
  }, [commandService, message.id]);

  // Track local stream→idle transitions to compute elapsed time. Historical
  // messages loaded with isStreaming=false from persistence never trigger this,
  // so they don't show a misleading "elapsed since now" duration.
  const wasStreamingRef = useRef(!!message.isStreaming);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  useEffect(() => {
    if (wasStreamingRef.current && !message.isStreaming) {
      setCompletedAt(Date.now());
    }
    wasStreamingRef.current = !!message.isStreaming;
  }, [message.isStreaming]);

  const lastTextIdx = getLastTextPartIndex(message.parts);
  const isStreaming = !!message.isStreaming;
  const groups = groupParts(message.parts);
  const copyText = getCopyText(message.parts);

  const elapsedMs = completedAt !== null ? completedAt - message.createdAt : null;
  const totalTokens = message.usage?.totalTokens ?? 0;
  const metaText = elapsedMs !== null
    ? (totalTokens > 0
      ? localeService.t('agent-ui.chat.elapsed-with-tokens', formatElapsed(elapsedMs), formatTokens(totalTokens))
      : localeService.t('agent-ui.chat.elapsed', formatElapsed(elapsedMs)))
    : null;

  return (
    <div
      className="
        tm:group
        tm:flex tm:min-w-0 tm:justify-start
      "
    >
      <div className="tm:max-w-[95%] tm:min-w-0">
        {groups.map((group, gi): ReactNode => {
          if (group.kind === 'tool') {
            const toolParts = group.parts.map(({ part }) => part as IToolPart);
            // Split: widget-rendering tools (registered in GenerativeUI registry) render inline
            // via GenerativeUiBlock. Everything else falls back to the default ToolPartGroup.
            const generativeParts: IToolPart[] = [];
            const passthroughParts: IToolPart[] = [];
            for (const p of toolParts) {
              if (generativeUIRegistry.has(p.toolName)) {
                generativeParts.push(p);
              } else {
                passthroughParts.push(p);
              }
            }
            return (
              <div key={`tg-${gi}`}>
                {passthroughParts.length > 0 && (
                  <ToolPartGroup parts={passthroughParts} isStreaming={isStreaming} />
                )}
                {generativeParts.map((p) => (
                  <GenerativeUiBlock key={`gen-${p.toolCallId}`} part={p} />
                ))}
              </div>
            );
          }
          return (
            <div key={`og-${gi}`}>
              {group.parts.map(({ part, index }) => {
                switch (part.type) {
                  case 'text': {
                    const isLastText = index === lastTextIdx;
                    const showCursor = isStreaming && isLastText && part.text.length > 0;
                    return (
                      <TextPart
                        key={`text-${index}`}
                        part={part}
                        isStreaming={isStreaming && isLastText}
                        showStreamingCursor={showCursor}
                      />
                    );
                  }
                  case 'thinking': {
                    return <ThinkingPart key={`think-${index}`} part={part} />;
                  }
                  case 'image': {
                    return (
                      <div key={`img-${index}`} className="tm:my-1.5">
                        <ImagePart part={part} />
                      </div>
                    );
                  }
                  case 'error': {
                    return <ErrorPart key={`err-${index}`} part={part} />;
                  }
                  default: {
                    return null;
                  }
                }
              })}
            </div>
          );
        })}
        {!isStreaming && hasAuthoredOutput(message.parts, copyText) && (
          <>
            {metaText && (
              <div className="tm:mt-1.5 tm:flex tm:items-center tm:gap-1 tm:text-[0.66rem] tm:text-grey">
                <span className="tm:text-grey-fg">✻</span>
                <span>{metaText}</span>
              </div>
            )}
            <MessageActions
              copyText={copyText.length > 0 ? copyText : undefined}
              onRetry={handleRetry}
            />
          </>
        )}
      </div>
    </div>
  );
});
