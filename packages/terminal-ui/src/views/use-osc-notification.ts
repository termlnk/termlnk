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

import type { ICreateNotificationParams } from '@termlnk/core';
import type { Terminal } from '@xterm/xterm';
import type { RefObject } from 'react';
import { INotificationService } from '@termlnk/core';
import { useDependency } from '@termlnk/design';
import { registerOscNotificationHandlers } from '@termlnk/terminal';
import { useCallback, useEffect } from 'react';

export interface IUseOscNotificationOptions {
  sessionId: string;
  xtermRef: RefObject<Terminal | null>;
  enabled: boolean;
}

/**
 * Hook that registers OSC notification handlers (OSC 9/99/777) on an xterm terminal.
 * Shared between local and SSH terminal views.
 */
export function useOscNotification(options: IUseOscNotificationOptions) {
  const { sessionId, xtermRef, enabled } = options;
  const notificationService = useDependency(INotificationService);

  const handleNotification = useCallback(
    (params: ICreateNotificationParams, oscNumber: number) => {
      notificationService.notify({
        ...params,
        groupId: sessionId,
        metadata: {
          ...params.metadata,
          oscNumber,
          sessionId,
        },
      });
    },
    [notificationService, sessionId]
  );

  useEffect(() => {
    if (!enabled) return;

    const term = xtermRef.current;
    if (!term) return;

    const disposables = registerOscNotificationHandlers(term, handleNotification);

    return () => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    };
  }, [enabled, xtermRef, handleNotification]);
}
