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
import { ArrowDownToLine, ArrowUpFromLine, Check, Loader2, X } from 'lucide-react';

interface ITransferPanelProps {
  transfers: ISFTPTransferTask[];
  onCancel: (transferId: string) => void;
  onClearCompleted: () => void;
}

export function TransferPanel({ transfers, onCancel, onClearCompleted }: ITransferPanelProps) {
  if (transfers.length === 0) {
    return null;
  }

  const hasCompleted = transfers.some((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');

  return (
    <div className="tm:border-t tm:border-line tm:bg-one-bg">
      <div className="tm:flex tm:items-center tm:justify-between tm:px-3 tm:py-1.5 tm:text-[11px] tm:text-grey-fg">
        <span className="tm:font-medium">
          Transfers (
          {transfers.length}
          )
        </span>
        {hasCompleted && (
          <button
            type="button"
            className="
              tm:text-grey-fg2
              tm:hover:text-light-grey
            "
            onClick={onClearCompleted}
          >
            Clear completed
          </button>
        )}
      </div>
      <div className="tm:max-h-32 tm:overflow-y-auto">
        {transfers.map((task) => (
          <TransferItem key={task.id} task={task} onCancel={onCancel} />
        ))}
      </div>
    </div>
  );
}

function TransferItem({ task, onCancel }: { task: ISFTPTransferTask; onCancel: (id: string) => void }) {
  const progress = task.totalBytes > 0
    ? Math.round((task.transferredBytes / task.totalBytes) * 100)
    : 0;

  const Icon = task.direction === 'upload' ? ArrowUpFromLine : ArrowDownToLine;

  return (
    <div className="tm:flex tm:items-center tm:gap-2 tm:px-3 tm:py-1 tm:text-[12px]">
      <Icon size={14} className="tm:shrink-0 tm:text-grey-fg" />
      <div className="tm:min-w-0 tm:flex-1">
        <div className="tm:flex tm:items-center tm:gap-2">
          <span className="tm:truncate tm:text-grey-fg2">{task.filename}</span>
          <StatusBadge status={task.status} />
        </div>
        {task.status === 'transferring' && (
          <div className="tm:mt-0.5 tm:h-1 tm:rounded-full tm:bg-one-bg3">
            <div
              className="tm:h-1 tm:rounded-full tm:bg-blue tm:transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      <span className="tm:shrink-0 tm:text-[11px] tm:text-grey-fg tm:tabular-nums">
        {task.status === 'transferring' ? `${progress}%` : ''}
      </span>
      {(task.status === 'pending' || task.status === 'transferring') && (
        <button
          type="button"
          className="
            tm:shrink-0 tm:text-grey-fg
            tm:hover:text-red
          "
          onClick={() => onCancel(task.id)}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'transferring':
      return <Loader2 size={12} className="tm:shrink-0 tm:animate-spin tm:text-blue" />;
    case 'completed':
      return <Check size={12} className="tm:shrink-0 tm:text-green" />;
    case 'failed':
      return <X size={12} className="tm:shrink-0 tm:text-red" />;
    case 'cancelled':
      return <span className="tm:text-[10px] tm:text-grey">cancelled</span>;
    default:
      return null;
  }
}
