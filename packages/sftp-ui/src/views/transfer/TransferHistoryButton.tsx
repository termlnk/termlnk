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

import type { ISFTPTransferTask } from '@termlnk/rpc';
import { cn, useDependency } from '@termlnk/design';
import { ArrowUpDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ITransferHistoryService } from '../../services/transfer/transfer-history.service';

export function TransferHistoryButton() {
  const historyService = useDependency(ITransferHistoryService);
  const [transfers, setTransfers] = useState<ISFTPTransferTask[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sub = historyService.transfers$.subscribe(setTransfers);
    return () => sub.unsubscribe();
  }, [historyService]);

  useEffect(() => {
    const sub = historyService.overlayVisible$.subscribe(setVisible);
    return () => sub.unsubscribe();
  }, [historyService]);

  const activeCount = transfers.filter(
    (t) => t.status === 'pending' || t.status === 'transferring'
  ).length;

  return (
    <button
      type="button"
      className={cn(
        'tm:relative tm:flex tm:items-center tm:gap-1 tm:rounded-md tm:px-2 tm:py-1 tm:text-[12px] tm:transition-colors',
        {
          'tm:bg-blue/20 tm:text-blue': visible,
          'tm:text-light-grey tm:hover:text-white': !visible,
        }
      )}
      onClick={() => historyService.toggleOverlay()}
      title="Transfers"
    >
      <ArrowUpDown size={14} strokeWidth={1.6} />
      <span>Transfers</span>
      {activeCount > 0 && (
        <span
          className={`
            tm:flex tm:h-4 tm:min-w-4 tm:items-center tm:justify-center tm:rounded-full tm:bg-blue tm:px-1
            tm:text-[10px] tm:font-medium tm:text-white
          `}
        >
          {activeCount}
        </span>
      )}
    </button>
  );
}
