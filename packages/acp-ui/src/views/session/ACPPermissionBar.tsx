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

import type { IACPPermissionRequest } from '@termlnk/acp';
import { Button, cn } from '@termlnk/design';
import { ShieldQuestion } from 'lucide-react';
import { useState } from 'react';

export interface IACPPermissionBarProps {
  request: IACPPermissionRequest | null;
  onRespond: (requestId: string, optionId: string) => Promise<void>;
}

export function ACPPermissionBar({ request, onRespond }: IACPPermissionBarProps) {
  const [busy, setBusy] = useState(false);

  if (!request) {
    return null;
  }

  const handle = async (optionId: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await onRespond(request.requestId, optionId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn('tm:flex tm:flex-col tm:gap-2 tm:border-t tm:border-line tm:bg-one-bg tm:px-3 tm:py-2')}
    >
      <div className="tm:flex tm:items-center tm:gap-1.5 tm:text-xs tm:text-light-grey">
        <ShieldQuestion size={12} className="tm:shrink-0 tm:text-yellow" />
        <span className="tm:truncate">
          {request.title || request.toolName}
        </span>
      </div>
      <div className="tm:flex tm:flex-wrap tm:gap-1.5">
        {request.options.map((opt) => {
          const isAllow = opt.kind === 'allow_once' || opt.kind === 'allow_always';
          return (
            <Button
              key={opt.optionId}
              size="sm"
              variant={isAllow ? 'default' : 'outline'}
              disabled={busy}
              onClick={() => void handle(opt.optionId)}
              className="tm:h-7 tm:text-[11px]"
            >
              {opt.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
