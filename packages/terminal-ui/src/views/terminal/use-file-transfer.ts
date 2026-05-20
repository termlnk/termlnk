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

import type { FileTransferEvent, IFileTransferService } from '@termlnk/rpc';
import { FileTransferEventType } from '@termlnk/rpc';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface IUseFileTransferOptions {
  backendSessionId: string | null;
  fileTransferService: IFileTransferService;
}

export function useFileTransfer(options: IUseFileTransferOptions) {
  const { backendSessionId, fileTransferService } = options;
  const [transferEvent, setTransferEvent] = useState<FileTransferEvent | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!backendSessionId) return;

    const sub = fileTransferService.transferEvent$(backendSessionId).subscribe((event) => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      setTransferEvent(event);

      if (event.type === FileTransferEventType.COMPLETE || event.type === FileTransferEventType.CANCELLED || event.type === FileTransferEventType.ERROR) {
        clearTimerRef.current = setTimeout(() => {
          setTransferEvent(null);
          clearTimerRef.current = null;
        }, 3000);
      }
    });

    return () => {
      sub.unsubscribe();
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, [backendSessionId, fileTransferService]);

  const cancelTransfer = useCallback(async () => {
    if (!backendSessionId) return;
    await fileTransferService.cancelTransfer(backendSessionId);
  }, [backendSessionId, fileTransferService]);

  return { transferEvent, cancelTransfer };
}
