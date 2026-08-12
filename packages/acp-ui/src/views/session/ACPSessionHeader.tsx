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

import type { IACPSessionInfo } from '@termlnk/acp';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { Bot } from 'lucide-react';

export interface IACPSessionHeaderProps {
  session: IACPSessionInfo | null;
  onCancel?: () => void;
  isStreaming?: boolean;
}

export function ACPSessionHeader({ session, onCancel, isStreaming }: IACPSessionHeaderProps) {
  const localeService = useDependency(LocaleService);

  if (!session) {
    return null;
  }

  return (
    <div
      className={cn(`
        tm:flex tm:h-9 tm:shrink-0 tm:items-center tm:gap-2 tm:border-b tm:border-line tm:bg-one-bg tm:px-3
      `)}
    >
      <Bot size={14} className="tm:shrink-0 tm:text-nord-blue" />
      <div className="tm:min-w-0 tm:flex-1 tm:truncate tm:text-xs tm:text-light-grey">
        <span className="tm:font-medium">{session.providerTitle}</span>
        <span className="tm:mx-1.5 tm:text-grey">·</span>
        <span className="tm:text-grey-fg" title={session.cwd}>{session.cwd || '—'}</span>
      </div>
      {session.currentModeId && (
        <span className="tm:rounded-sm tm:bg-one-bg2 tm:px-1.5 tm:py-0.5 tm:text-[10px] tm:text-grey-fg">
          {session.currentModeId}
        </span>
      )}
      {isStreaming && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={cn(`
            tm:rounded-sm tm:px-2 tm:py-0.5 tm:text-[11px] tm:text-red tm:transition-colors
            tm:hover:bg-one-bg2
          `)}
        >
          {localeService.t('acp-ui.session.stop')}
        </button>
      )}
    </div>
  );
}
