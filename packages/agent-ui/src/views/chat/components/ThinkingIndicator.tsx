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
import { cn, useDependency } from '@termlnk/design';
import { Square } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

interface IThinkingIndicatorProps {
  startedAt: number;
  onStop?: () => void;
  className?: string;
}

const STAGE_THRESHOLDS_MS = [0, 10_000, 30_000] as const;

function pickStageKey(elapsed: number): string {
  if (elapsed >= STAGE_THRESHOLDS_MS[2]) {
    return 'agent-ui.chat.thinking-stage-3';
  }
  if (elapsed >= STAGE_THRESHOLDS_MS[1]) {
    return 'agent-ui.chat.thinking-stage-2';
  }
  return 'agent-ui.chat.thinking-stage-1';
}

export const ThinkingIndicator = memo(function ThinkingIndicator({ startedAt, onStop, className }: IThinkingIndicatorProps) {
  const localeService = useDependency(LocaleService);
  const [tickedAt, setTickedAt] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTickedAt(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, tickedAt - startedAt);
  const stageKey = useMemo(() => pickStageKey(elapsed), [elapsed]);

  return (
    <div
      className={cn(
        'tm:mt-3 tm:flex tm:items-center tm:gap-2 tm:text-xs',
        className
      )}
    >
      <span
        className="tm-thinking-pulse tm:inline-block tm:size-1.5 tm:shrink-0 tm:rounded-full tm:bg-nord-blue"
        aria-hidden
      />
      <span className="tm-shimmer-text tm:font-medium">
        {localeService.t(stageKey)}
      </span>
      {onStop && (
        <button
          type="button"
          onClick={onStop}
          className="
            tm:ml-1 tm:inline-flex tm:items-center tm:gap-1 tm:rounded-sm tm:px-1.5 tm:py-0.5 tm:text-[0.66rem]
            tm:text-light-grey tm:transition-colors
            tm:hover:bg-one-bg tm:hover:text-white
          "
          aria-label={localeService.t('agent-ui.chat.action-stop')}
        >
          <Square size={9} className="tm:fill-current" />
          <span>{localeService.t('agent-ui.chat.action-stop')}</span>
        </button>
      )}
    </div>
  );
});
