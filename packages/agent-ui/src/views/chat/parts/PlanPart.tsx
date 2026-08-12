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

import type { IPlanEntry, IPlanPart } from '@termlnk/agent';
import { cn } from '@termlnk/design';
import { Check, Circle, LoaderCircle } from 'lucide-react';
import { memo } from 'react';

export interface IPlanPartProps {
  part: IPlanPart;
}

function StatusIcon({ status }: { status: IPlanEntry['status'] }) {
  if (status === 'completed') {
    return <Check size={12} className="tm:shrink-0 tm:text-green" />;
  }
  if (status === 'in_progress') {
    return <LoaderCircle size={12} className="tm:shrink-0 tm:animate-spin tm:text-nord-blue" />;
  }
  return <Circle size={12} className="tm:shrink-0 tm:text-grey" />;
}

export const PlanPart = memo(function PlanPart({ part }: IPlanPartProps) {
  if (part.entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('tm:my-1.5 tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:px-2.5 tm:py-2')}
    >
      <ul className="tm:flex tm:flex-col tm:gap-1.5">
        {part.entries.map((entry, i) => (
          <li
            key={`${i}-${entry.content.slice(0, 24)}`}
            className="tm:flex tm:items-start tm:gap-1.5 tm:text-xs tm:text-light-grey"
          >
            <StatusIcon status={entry.status} />
            <span
              className={cn({
                'tm:text-grey tm:line-through': entry.status === 'completed',
              })}
            >
              {entry.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});
