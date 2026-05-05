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
import { Ban, ShieldOff } from 'lucide-react';
import { memo } from 'react';

interface IPermissionDeniedNoteProps {
  /**
   * Raw output text from the wrapped tool — the wrap layer prefixes
   *  '[Permission denied] <reason>'. We classify the reason string.
   */
  outputText: string;
}

type DenialKind = 'plan-mode' | 'rule' | 'mode' | 'user' | 'unknown';

function classify(reasonText: string): DenialKind {
  const lowered = reasonText.toLowerCase();
  if (lowered.includes('plan-mode') || lowered.includes('plan mode')) {
    return 'plan-mode';
  }
  if (lowered.includes('by rule')) {
    return 'rule';
  }
  if (lowered.includes('by mode')) {
    return 'mode';
  }
  if (lowered.includes('by user') || lowered.includes('aborted')) {
    return 'user';
  }
  return 'unknown';
}

export const PermissionDeniedNote = memo(function PermissionDeniedNote({ outputText }: IPermissionDeniedNoteProps) {
  const localeService = useDependency(LocaleService);
  const reason = outputText.replace(/^\[Permission denied\]\s*/, '').trim();
  const kind = classify(reason);

  const t = (key: string): string => localeService.t(`agent-ui.permission.${key}`);

  const labelKey: Record<DenialKind, string> = {
    'plan-mode': 'denied-by-plan-mode',
    rule: 'denied-by-rule',
    mode: 'denied-by-mode',
    user: 'denied-by-user',
    unknown: 'denied',
  };

  const Icon = kind === 'plan-mode' ? ShieldOff : Ban;

  return (
    <div
      className={cn(
        'tm:flex tm:items-start tm:gap-1.5 tm:px-2 tm:py-1.5 tm:text-[0.7rem]',
        {
          'tm:text-yellow': kind === 'plan-mode',
          'tm:text-red': kind !== 'plan-mode',
        }
      )}
    >
      <Icon size={11} className="tm:mt-[2px] tm:shrink-0" />
      <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-0.5">
        <span>{t(labelKey[kind])}</span>
        {reason && reason !== 'plan-mode' && (
          <span className="tm:text-[0.65rem] tm:text-grey-fg">{reason}</span>
        )}
      </div>
    </div>
  );
});
