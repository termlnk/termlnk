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

import { ICommandService } from '@termlnk/core';
import { Button, useDependency, useObservable } from '@termlnk/design';
import { useCallback } from 'react';
import { ToggleRightSidebarCommand } from '../../../commands/toggle-right-sidebar.command';
import { ResizableService } from '../../../services/resizable/resizable.service';
import { TooltipWrapper } from '../tooltip/TooltipWrapper';

export function RightSidebarToggle() {
  const resizableService = useDependency(ResizableService);
  const commandService = useDependency(ICommandService);
  const layout = useObservable(resizableService.layout$, resizableService.layout);
  const isOpen = layout.right > 0;

  const handleToggle = useCallback(() => {
    commandService.executeCommand(ToggleRightSidebarCommand.id);
  }, [commandService]);

  return (
    <TooltipWrapper
      side="bottom"
      commandId={ToggleRightSidebarCommand.id}
      labelKey={isOpen ? 'ui.right-sidebar-toggle.close-title' : 'ui.right-sidebar-toggle.open-title'}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleToggle}
      >
        <PanelRightFilledIcon size={14} strokeWidth={1.5} isOpen={isOpen} />
      </Button>
    </TooltipWrapper>
  );
}

function PanelRightFilledIcon({ isOpen = false, size = 24, strokeWidth = 2 }: { isOpen?: boolean; size?: number; strokeWidth?: number }) {
  if (isOpen) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <rect x="15" y="3" width="6" height="18" rx="2" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <line x1="15" x2="15" y1="3" y2="21" />
    </svg>
  );
}
