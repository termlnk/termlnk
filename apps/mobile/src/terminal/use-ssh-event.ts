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

import type {
  IMobileAuthFailedEvent,
  IMobileHostKeyFirstUseEvent,
  IMobileHostKeyMismatchEvent,
  MobileSshSessionEvent,
} from '@termlnk/terminal-mobile';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { useConnectionService } from '../core/core-context';

type HostKeyEvent = IMobileHostKeyFirstUseEvent | IMobileHostKeyMismatchEvent;

export interface ISshEventState {
  readonly pendingEvent: MobileSshSessionEvent | null;
  readonly hostKeyEvent: HostKeyEvent | null;
  readonly authFailedEvent: IMobileAuthFailedEvent | null;
  readonly setPendingEvent: Dispatch<SetStateAction<MobileSshSessionEvent | null>>;
}

/**
 * Subscribe to interactive SSH session events (host key verify, auth failure)
 * for a specific host. On unmount, rejects any pending event to free the
 * suspended Promise and avoid leaks.
 *
 * @param hostId - A static host ID string, or a getter that returns the current
 *   host ID (for screens where the target changes dynamically). When passing a
 *   getter, wrap it in useCallback to avoid re-subscribing on every render.
 */
export function useSshEvent(hostId: string | (() => string | null)): ISshEventState {
  const connectionService = useConnectionService();
  const [pendingEvent, setPendingEvent] = useState<MobileSshSessionEvent | null>(null);

  useEffect(() => {
    const sub = connectionService.event$.subscribe((event) => {
      const target = typeof hostId === 'function' ? hostId() : hostId;
      if (target != null && event.hostId === target) {
        setPendingEvent(event);
      }
    });
    return () => {
      sub.unsubscribe();
      setPendingEvent((prev) => {
        if (prev) {
          if (prev.type === 'auth_failed') {
            prev.respond(null);
          } else {
            prev.respond(false);
          }
        }
        return null;
      });
    };
  }, [connectionService, hostId]);

  const hostKeyEvent: HostKeyEvent | null =
    pendingEvent?.type === 'host_key_first_use' || pendingEvent?.type === 'host_key_mismatch'
      ? pendingEvent
      : null;

  const authFailedEvent: IMobileAuthFailedEvent | null =
    pendingEvent?.type === 'auth_failed'
      ? pendingEvent
      : null;

  return { pendingEvent, hostKeyEvent, authFailedEvent, setPendingEvent };
}
