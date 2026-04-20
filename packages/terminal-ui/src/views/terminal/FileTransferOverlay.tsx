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

import type { FileTransferEvent } from '@termlnk/rpc';
import { Button, cn } from '@termlnk/design';
import { FileTransferEventType } from '@termlnk/rpc';
import { partial } from 'filesize';
import { ArrowDownToLine, ArrowUpFromLine, Loader2, X } from 'lucide-react';
import { useMemo } from 'react';

export interface IFileTransferOverlayProps {
  event: FileTransferEvent;
  onCancel: () => void;
}

const formatBytes = partial({ standard: 'jedec', round: 1 });

export function FileTransferOverlay({ event, onCancel }: IFileTransferOverlayProps) {
  const isActive = event.type === FileTransferEventType.STARTED || event.type === FileTransferEventType.PROGRESS;
  const isComplete = event.type === FileTransferEventType.COMPLETE;
  const isError = event.type === FileTransferEventType.ERROR;
  const isCancelled = event.type === FileTransferEventType.CANCELLED;

  const direction = (event.type === FileTransferEventType.STARTED || event.type === FileTransferEventType.PROGRESS || event.type === FileTransferEventType.COMPLETE)
    ? event.direction
    : null;

  const protocolLabel = event.protocol === 'zmodem' ? 'ZMODEM' : 'TRZSZ';

  const progressPercent = event.type === FileTransferEventType.PROGRESS && event.totalBytes > 0
    ? Math.round((event.bytesTransferred / event.totalBytes) * 100)
    : event.type === FileTransferEventType.COMPLETE ? 100 : 0;

  const fileName = (event.type === FileTransferEventType.PROGRESS || event.type === FileTransferEventType.COMPLETE)
    ? event.fileName
    : '';

  const fileCountLabel = event.type === FileTransferEventType.PROGRESS && event.fileCount && event.fileCount > 1
    ? `(${event.fileIndex}/${event.fileCount}) `
    : '';

  const bytesLabel = event.type === FileTransferEventType.PROGRESS && event.totalBytes > 0
    ? `${formatBytes(event.bytesTransferred)} / ${formatBytes(event.totalBytes)}`
    : '';

  const statusText = useMemo(() => {
    if (event.type === FileTransferEventType.STARTED) return `${protocolLabel} ${direction === 'upload' ? 'Upload' : 'Download'} starting...`;
    if (event.type === FileTransferEventType.PROGRESS) return `${fileCountLabel}${fileName} — ${progressPercent}%`;
    if (event.type === FileTransferEventType.COMPLETE) return `${fileName || 'Transfer'} complete`;
    if (event.type === FileTransferEventType.ERROR) return `Error: ${event.message}`;
    if (event.type === FileTransferEventType.CANCELLED) return 'Transfer cancelled';
    return '';
  }, [event, protocolLabel, direction, fileName, progressPercent, fileCountLabel]);

  const DirectionIcon = direction === 'upload' ? ArrowUpFromLine : ArrowDownToLine;

  return (
    <div
      className={cn(
        'tm:absolute tm:right-4 tm:bottom-4 tm:z-50',
        'tm:flex tm:w-72 tm:flex-col tm:gap-2 tm:rounded-lg tm:p-3',
        'tm:border tm:border-line tm:bg-one-bg tm:shadow-lg',
        'tm:text-sm tm:text-light-grey',
        'tm:animate-in tm:fade-in tm:slide-in-from-bottom-2'
      )}
    >
      <div className="tm:flex tm:items-center tm:justify-between">
        <div className="tm:flex tm:items-center tm:gap-2">
          {isActive
            ? (
              <Loader2 className="tm:size-4 tm:animate-spin tm:text-blue" />
            )
            : (
              <DirectionIcon
                className={cn(
                  'tm:size-4',
                  isComplete && 'tm:text-green',
                  isError && 'tm:text-red',
                  isCancelled && 'tm:text-grey'
                )}
              />
            )}
          <span className="tm:font-medium">{protocolLabel}</span>
          {direction && (
            <span className="tm:text-grey-fg">
              {direction === 'upload' ? 'Upload' : 'Download'}
            </span>
          )}
        </div>
        {isActive && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="tm:hover:text-red"
            onClick={onCancel}
          >
            <X className="tm:size-3" />
          </Button>
        )}
      </div>

      {(event.type === FileTransferEventType.PROGRESS || event.type === FileTransferEventType.COMPLETE) && (
        <div className="tm:flex tm:flex-col tm:gap-1">
          {fileName && (
            <div className="tm:truncate tm:text-xs tm:text-grey-fg">
              {fileCountLabel}
              {fileName}
            </div>
          )}
          <div className="tm:h-1.5 tm:w-full tm:overflow-hidden tm:rounded-full tm:bg-one-bg3">
            <div
              className={cn(
                'tm:h-full tm:rounded-full tm:transition-all tm:duration-300',
                isComplete ? 'tm:bg-green' : 'tm:bg-blue'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="tm:flex tm:items-center tm:justify-between tm:text-xs tm:text-grey">
            {bytesLabel && <span>{bytesLabel}</span>}
            <span className={!bytesLabel ? 'tm:ml-auto' : ''}>
              {progressPercent}
              %
            </span>
          </div>
        </div>
      )}

      {(event.type === FileTransferEventType.ERROR || event.type === FileTransferEventType.CANCELLED || event.type === FileTransferEventType.STARTED) && (
        <div
          className={cn(
            'tm:text-xs',
            {
              'tm:text-red': isError,
              'tm:text-grey-fg': isCancelled,
            }
          )}
        >
          {statusText}
        </div>
      )}
    </div>
  );
}
