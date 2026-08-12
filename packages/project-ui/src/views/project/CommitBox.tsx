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
import { cn, useDependency, useObservable } from '@termlnk/design';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { IProjectPanelService } from '../../services/project-panel.service';

/**
 * Collapsible commit box. Collapsed by default: the file list is what the panel
 * is for, and a permanent textarea eats a third of a narrow sidebar.
 */
export function CommitBox() {
  const localeService = useDependency(LocaleService);
  const panel = useDependency(IProjectPanelService);
  const files = useObservable(panel.diffFiles$, []);
  const busy = useObservable(panel.busy$, false);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const stagedCount = useMemo(() => files.filter((f) => f.staged).length, [files]);
  const canCommit = !busy && message.trim().length > 0 && stagedCount > 0;

  const commit = useCallback(async () => {
    if (!canCommit) {
      return;
    }
    await panel.commit(message);
    setMessage('');
  }, [canCommit, message, panel]);

  return (
    <div className="tm:shrink-0 tm:border-t tm:border-line">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(`
          tm:flex tm:h-8 tm:w-full tm:items-center tm:gap-1 tm:px-2 tm:text-left tm:text-xs tm:text-grey-fg2
          tm:hover:bg-one-bg2
        `)}
      >
        {open
          ? <ChevronDown size={12} className="tm:shrink-0 tm:text-grey" />
          : <ChevronRight size={12} className="tm:shrink-0 tm:text-grey" />}
        <span className="tm:flex-1 tm:truncate">{localeService.t('project-ui.git.commit')}</span>
        {stagedCount > 0 && (
          <span className="tm:shrink-0 tm:text-[10px] tm:text-grey tm:tabular-nums">
            {localeService.t('project-ui.changes.staged-count', String(stagedCount))}
          </span>
        )}
      </button>

      {open && (
        <div className="tm:p-2 tm:pt-0">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={localeService.t('project-ui.git.commit-message')}
            className={cn(`
              tm:mb-1.5 tm:w-full tm:resize-none tm:rounded-sm tm:border tm:border-line tm:bg-black tm:px-2 tm:py-1.5
              tm:text-xs tm:text-light-grey tm:outline-none
              tm:placeholder:text-grey
              tm:focus:border-nord-blue
            `)}
          />
          <button
            type="button"
            disabled={!canCommit}
            onClick={() => void commit()}
            className={cn(
              'tm:h-7 tm:w-full tm:rounded-sm tm:text-xs tm:font-medium tm:transition-colors',
              {
                'tm:bg-nord-blue tm:text-white tm:hover:opacity-90': canCommit,
                'tm:bg-one-bg2 tm:text-grey': !canCommit,
              }
            )}
          >
            {localeService.t('project-ui.git.commit')}
          </button>
        </div>
      )}
    </div>
  );
}
