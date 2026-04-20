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

import { cn } from '@termlnk/design';
import { ChevronRight, Home } from 'lucide-react';

interface IBreadcrumbNavProps {
  path: string;
  separator?: string;
  onNavigate: (path: string) => void;
}

export function BreadcrumbNav({ path, separator = '/', onNavigate }: IBreadcrumbNavProps) {
  const parts = path.split(separator).filter(Boolean);

  return (
    <div className="tm:flex tm:items-center tm:gap-0.5 tm:overflow-hidden tm:text-[12px] tm:text-white">
      <button
        type="button"
        className="
          tm:flex tm:shrink-0 tm:items-center tm:rounded-sm tm:p-1
          tm:hover:bg-one-bg2
        "
        onClick={() => onNavigate(separator)}
      >
        <Home size={14} />
      </button>

      {parts.map((part, index) => {
        const fullPath = separator + parts.slice(0, index + 1).join(separator);
        const isLast = index === parts.length - 1;

        return (
          <div key={fullPath} className="tm:flex tm:min-w-0 tm:items-center tm:gap-0.5">
            <ChevronRight size={12} className="tm:shrink-0" />
            <button
              type="button"
              className={cn('tm:truncate tm:rounded-sm tm:px-1 tm:py-0.5', {
                'tm:font-medium tm:text-white': isLast,
                'tm:text-white tm:hover:bg-one-bg2': !isLast,
              })}
              onClick={() => !isLast && onNavigate(fullPath)}
              disabled={isLast}
            >
              {part}
            </button>
          </div>
        );
      })}
    </div>
  );
}
