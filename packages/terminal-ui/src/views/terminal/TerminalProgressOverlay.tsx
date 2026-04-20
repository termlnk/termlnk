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

import type { ReactElement } from 'react';
import type { IXtermProgressState } from '../hooks';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { AlertCircle, Loader2, PauseCircle } from 'lucide-react';
import { XTERM_PROGRESS_STATE } from '../hooks';

export interface ITerminalProgressOverlayProps {
  progress: IXtermProgressState;
  className?: string;
}

interface IProgressMeta {
  labelKey: string;
  barClassName: string;
  textClassName: string;
}

function clampPercent(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function getProgressMeta(state: IXtermProgressState['state']): IProgressMeta {
  switch (state) {
    case XTERM_PROGRESS_STATE.ERROR:
      return { labelKey: 'terminal-ui.progress.state.error', barClassName: 'tm:bg-red', textClassName: 'tm:text-red' };
    case XTERM_PROGRESS_STATE.INDETERMINATE:
      return { labelKey: 'terminal-ui.progress.state.indeterminate', barClassName: 'tm:bg-blue', textClassName: 'tm:text-blue' };
    case XTERM_PROGRESS_STATE.PAUSED:
      return { labelKey: 'terminal-ui.progress.state.paused', barClassName: 'tm:bg-yellow', textClassName: 'tm:text-yellow' };
    default:
      return { labelKey: 'terminal-ui.progress.state.running', barClassName: 'tm:bg-blue', textClassName: 'tm:text-light-grey' };
  }
}

function renderProgressIcon(state: IXtermProgressState['state']): ReactElement | null {
  switch (state) {
    case XTERM_PROGRESS_STATE.ERROR:
      return <AlertCircle className="tm:size-3.5 tm:text-red" />;
    case XTERM_PROGRESS_STATE.PAUSED:
      return <PauseCircle className="tm:size-3.5 tm:text-yellow" />;
    case XTERM_PROGRESS_STATE.RUNNING:
    case XTERM_PROGRESS_STATE.INDETERMINATE:
      return <Loader2 className="tm:size-3.5 tm:animate-spin tm:text-blue" />;
    default:
      return null;
  }
}

function renderProgressFill(state: IXtermProgressState['state'], barClassName: string, percent: number): ReactElement {
  if (state === XTERM_PROGRESS_STATE.INDETERMINATE) {
    return <div className={cn('tm:h-full tm:w-2/5 tm:animate-pulse tm:rounded-full', barClassName)} />;
  }

  return (
    <div
      className={cn('tm:h-full tm:rounded-full tm:transition-all tm:duration-300', barClassName)}
      style={{ width: `${percent}%` }}
    />
  );
}

export function TerminalProgressOverlay({ progress, className }: ITerminalProgressOverlayProps): ReactElement {
  const localeService = useDependency(LocaleService);
  const percent = clampPercent(progress.value);
  const progressMeta = getProgressMeta(progress.state);
  const valueText = progress.state === XTERM_PROGRESS_STATE.INDETERMINATE
    ? localeService.t('terminal-ui.progress.indeterminateValue')
    : `${percent}%`;

  return (
    <div
      className={cn(
        'tm:pointer-events-none tm:absolute tm:right-4 tm:bottom-4 tm:z-40',
        'tm:flex tm:w-72 tm:flex-col tm:gap-2 tm:rounded-lg tm:border tm:border-line tm:bg-one-bg tm:p-3',
        'tm:animate-in tm:shadow-lg tm:fade-in tm:slide-in-from-bottom-2',
        className
      )}
    >
      <div className="tm:flex tm:items-center tm:justify-between tm:gap-2">
        <span className="tm:text-xs tm:font-medium tm:text-grey-fg">
          {localeService.t('terminal-ui.progress.title')}
        </span>
        <span className={cn('tm:text-xs tm:font-medium', progressMeta.textClassName)}>
          {localeService.t(progressMeta.labelKey)}
        </span>
      </div>

      <div className="tm:h-1.5 tm:w-full tm:overflow-hidden tm:rounded-full tm:bg-one-bg3">
        {renderProgressFill(progress.state, progressMeta.barClassName, percent)}
      </div>

      <div className="tm:flex tm:items-center tm:justify-between tm:text-xs tm:text-grey-fg">
        <span className="tm:flex tm:items-center tm:gap-1">
          {renderProgressIcon(progress.state)}
          <span>{localeService.t('terminal-ui.progress.source')}</span>
        </span>

        <span className="tm:font-medium tm:text-light-grey">
          {valueText}
        </span>
      </div>
    </div>
  );
}
