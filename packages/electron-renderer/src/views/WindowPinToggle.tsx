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

import { Button, cn, PinIcon, useDependency } from '@termlnk/design';
import { IWindowManagerService } from '@termlnk/electron';
import { useCallback } from 'react';

interface IWindowPinToggleProps {
  windowId: number | null;
  alwaysOnTop: boolean;
}

export function WindowPinToggle({ windowId, alwaysOnTop }: IWindowPinToggleProps) {
  const windowManagerService = useDependency(IWindowManagerService);

  const handleToggle = useCallback(() => {
    if (windowId === null) {
      return;
    }
    windowManagerService.setAlwaysOnTop(windowId, !alwaysOnTop);
  }, [windowManagerService, windowId, alwaysOnTop]);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
    >
      <PinIcon
        size={14}
        strokeWidth={1.5}
        fill={alwaysOnTop ? 'currentColor' : 'none'}
        className={cn('tm:transition-transform', {
          'tm:rotate-45': !alwaysOnTop,
        })}
      />
    </Button>
  );
}
