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

import type { ICespEvent, IPendingInteractionPayload } from '@termlnk/island';
import type { Observable } from 'rxjs';
import { AUTO_COLLAPSE_DELAY_MS, CespEventCategory } from '@termlnk/island';
import { useCallback, useEffect, useRef } from 'react';

const AUTO_EXPAND_DELAY_MS = 100;
/** Flash-expand duration after a task completes before collapsing back. */
const TASK_COMPLETE_COLLAPSE_DELAY_MS = 3000;

type TimeoutId = ReturnType<typeof setTimeout>;
interface TimerRef { current: TimeoutId | undefined }

function clearTimer(ref: TimerRef): void {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = undefined;
  }
}

export function useAutoCollapse(
  expanded: boolean,
  setExpanded: (v: boolean) => void,
  pendingInteractions: IPendingInteractionPayload[],
  cespEvent$: Observable<ICespEvent>
) {
  const collapseTimerRef = useRef<TimeoutId | undefined>(undefined);
  const expandTimerRef = useRef<TimeoutId | undefined>(undefined);

  // Only classic permission pendings gate the collapse — AskUserQuestion
  // pendings are visual-only (pet Question state) and must not lock the
  // island open on hover-out.
  const hasPermissionPending = pendingInteractions.some((p) => p.kind === 'permission');
  const hasPermissionPendingRef = useRef(hasPermissionPending);
  hasPermissionPendingRef.current = hasPermissionPending;

  const onMouseLeave = useCallback(() => {
    clearTimer(expandTimerRef);
    if (hasPermissionPending) {
      return;
    }
    collapseTimerRef.current = setTimeout(() => {
      setExpanded(false);
    }, AUTO_COLLAPSE_DELAY_MS);
  }, [hasPermissionPending, setExpanded]);

  const onMouseEnter = useCallback(() => {
    // Shared with the task-complete flash timer, so hover naturally cancels it.
    clearTimer(collapseTimerRef);
    if (!expanded) {
      expandTimerRef.current = setTimeout(() => {
        setExpanded(true);
      }, AUTO_EXPAND_DELAY_MS);
    }
  }, [expanded, setExpanded]);

  // Flash-expand on TaskComplete, then collapse after a short delay. Skip when
  // the user still owes a response — the permission/question auto-expand path
  // owns the expanded state in that case.
  useEffect(() => {
    const sub = cespEvent$.subscribe((event) => {
      if (event.category !== CespEventCategory.TaskComplete) {
        return;
      }
      if (hasPermissionPendingRef.current) {
        return;
      }
      setExpanded(true);
      clearTimer(collapseTimerRef);
      collapseTimerRef.current = setTimeout(() => {
        // A new permission request may have landed during the display window.
        if (hasPermissionPendingRef.current) {
          return;
        }
        setExpanded(false);
      }, TASK_COMPLETE_COLLAPSE_DELAY_MS);
    });
    return () => sub.unsubscribe();
  }, [cespEvent$, setExpanded]);

  useEffect(() => {
    return () => {
      clearTimer(collapseTimerRef);
      clearTimer(expandTimerRef);
    };
  }, []);

  return { onMouseLeave, onMouseEnter };
}
