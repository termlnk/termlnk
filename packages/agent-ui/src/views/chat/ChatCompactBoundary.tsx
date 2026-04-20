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
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { ChevronDown, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';

interface IChatCompactBoundaryProps {
  message: IChatMessage;
}

const TOKEN_FORMATTER = new Intl.NumberFormat('en-US');

export const ChatCompactBoundary = memo(function ChatCompactBoundary({ message }: IChatCompactBoundaryProps) {
  const localeService = useDependency(LocaleService);
  const [expanded, setExpanded] = useState(false);

  const metadata = message.compactMetadata;
  if (!metadata) {
    return null;
  }

  const isManual = metadata.trigger === 'manual';
  const triggerLabel = isManual
    ? localeService.t('agent-ui.compact.trigger-manual')
    : localeService.t('agent-ui.compact.trigger-auto');
  const summaryToggleLabel = expanded
    ? localeService.t('agent-ui.compact.summary-collapse')
    : localeService.t('agent-ui.compact.summary-expand');

  return (
    <div className="tm:my-2 tm:flex tm:w-full tm:flex-col tm:items-center tm:gap-1.5">
      <div className="tm:flex tm:w-full tm:items-center tm:gap-2">
        <div className="tm:h-px tm:flex-1 tm:bg-line" />
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            `
              tm:flex tm:items-center tm:gap-1.5 tm:rounded-full tm:border tm:border-line tm:bg-one-bg tm:px-2.5 tm:py-1
              tm:text-[10px] tm:text-light-grey tm:transition-colors
              tm:hover:bg-one-bg2
            `,
            {
              'tm:text-blue': isManual,
              'tm:text-grey-fg': !isManual,
            }
          )}
          aria-expanded={expanded}
          title={summaryToggleLabel}
        >
          <Sparkles size={10} />
          <span className="tm:font-medium">
            {localeService.t('agent-ui.compact.boundary-title')}
          </span>
          <span className="tm:text-grey">·</span>
          <span>{triggerLabel}</span>
          <span className="tm:text-grey">·</span>
          <span>
            {localeService.t('agent-ui.compact.boundary-summarized', String(metadata.messagesSummarized))}
          </span>
          {metadata.preTokens > 0 && (
            <>
              <span className="tm:text-grey">·</span>
              <span>
                {TOKEN_FORMATTER.format(metadata.preTokens)}
                {' '}
                tokens
              </span>
            </>
          )}
          <ChevronDown
            size={10}
            className={cn('tm:text-grey tm:transition-transform', {
              'tm:rotate-180': expanded,
            })}
          />
        </button>
        <div className="tm:h-px tm:flex-1 tm:bg-line" />
      </div>

      {expanded && (
        <div
          className={`
            tm:w-full tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:px-3 tm:py-2 tm:text-[11px]/relaxed
            tm:whitespace-pre-wrap tm:text-grey-fg
          `}
        >
          {metadata.userInstructions && (
            <div className="tm:mb-1.5 tm:text-blue">
              <span className="tm:font-medium">
                {localeService.t('agent-ui.compact.summary-instructions')}
                :
              </span>
              {' '}
              {metadata.userInstructions}
            </div>
          )}
          {metadata.summary}
        </div>
      )}
    </div>
  );
});
