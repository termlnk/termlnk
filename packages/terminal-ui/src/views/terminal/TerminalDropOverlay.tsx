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
import { FileDown } from 'lucide-react';

export interface ITerminalDropOverlayProps {
  visible: boolean;
}

export function TerminalDropOverlay(props: ITerminalDropOverlayProps) {
  const { visible } = props;
  const localeService = useDependency(LocaleService);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        'tm:pointer-events-none tm:absolute tm:inset-0 tm:z-20',
        'tm:flex tm:flex-col tm:items-center tm:justify-center tm:gap-2',
        'tm:border-2 tm:border-dashed tm:border-blue tm:bg-black/60'
      )}
    >
      <FileDown className="tm:size-8 tm:text-blue" />
      <span className="tm:text-sm tm:text-light-grey">
        {localeService.t('terminal-ui.drop.hint')}
      </span>
    </div>
  );
}
