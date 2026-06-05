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

import type { IThinkingPart } from '@termlnk/agent';
import { cn } from '@termlnk/design';
import { ChevronDown } from 'lucide-react';
import { memo, useState } from 'react';

interface IThinkingPartProps {
  part: IThinkingPart;
}

export const ThinkingPart = memo(function ThinkingPart({ part }: IThinkingPartProps) {
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
          className={cn('tm:transition-transform tm:duration-150', { 'tm:rotate-180': expanded })}
        />
        <span>Thinking</span>
      </button>
      {expanded && (
        <div className="tm:mt-1 tm:rounded-sm tm:bg-one-bg tm:p-2 tm:text-xs/relaxed tm:text-grey-fg tm:select-text">
          {part.thinking}
        </div>
      )}
    </div>
  );
});
