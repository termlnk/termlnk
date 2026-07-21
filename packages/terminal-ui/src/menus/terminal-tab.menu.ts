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

import type { IAccessor } from '@termlnk/core';
import type { IMenuItem, MenuSchemaType } from '@termlnk/ui';
import { MenuItemType } from '@termlnk/ui';
import { map } from 'rxjs';
import { CloseWorkspaceTabCommand } from '../commands/close-workspace-tab.command';
import { CustomizeWorkspaceIconCommand } from '../commands/customize-workspace-icon.command';
import { RenameWorkspaceCommand } from '../commands/rename-workspace.command';
import { TogglePinWorkspaceCommand } from '../commands/toggle-pin-workspace.command';
import { TERMINAL_TAB_WORKSPACE_MENU } from '../services/workspace/contextmenu-positions';
import { IWorkspaceService } from '../services/workspace/workspace.service';

export function CustomizeWorkspaceIconMenuItemFactory(_accessor: IAccessor): IMenuItem {
  return {
    id: 'terminal-ui.terminal-tab.context-menu.customize-icon',
    commandId: CustomizeWorkspaceIconCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.terminal-tab.context-menu.customize-icon',
  };
}

export function RenameWorkspaceMenuItemFactory(_accessor: IAccessor): IMenuItem {
  return {
    id: 'terminal-ui.terminal-tab.context-menu.rename',
    commandId: RenameWorkspaceCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.terminal-tab.context-menu.rename',
  };
}

export function PinWorkspaceMenuItemFactory(accessor: IAccessor): IMenuItem {
  const workspaceService = accessor.get(IWorkspaceService);
  return {
    id: 'terminal-ui.terminal-tab.context-menu.pin',
    commandId: TogglePinWorkspaceCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.terminal-tab.context-menu.pin',
    hidden$: workspaceService.menuTarget$.pipe(
      map((targetId) => (targetId ? workspaceService.isTabItemPinned(targetId) : true))
    ),
  };
}

export function UnpinWorkspaceMenuItemFactory(accessor: IAccessor): IMenuItem {
  const workspaceService = accessor.get(IWorkspaceService);
  return {
    id: 'terminal-ui.terminal-tab.context-menu.unpin',
    commandId: TogglePinWorkspaceCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.terminal-tab.context-menu.unpin',
    hidden$: workspaceService.menuTarget$.pipe(
      map((targetId) => (targetId ? !workspaceService.isTabItemPinned(targetId) : true))
    ),
  };
}

export function CloseWorkspaceTabMenuItemFactory(accessor: IAccessor): IMenuItem {
  const workspaceService = accessor.get(IWorkspaceService);
  return {
    id: 'terminal-ui.terminal-tab.context-menu.close',
    commandId: CloseWorkspaceTabCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.terminal-tab.context-menu.close',
    disabled$: workspaceService.menuTarget$.pipe(
      map((targetId) => (targetId ? workspaceService.isTabItemPinned(targetId) : false))
    ),
  };
}

export const terminalTabMenuSchema: MenuSchemaType = {
  [TERMINAL_TAB_WORKSPACE_MENU]: {
    'customize-icon': { order: 0, menuItemFactory: CustomizeWorkspaceIconMenuItemFactory },
    rename: { order: 1, menuItemFactory: RenameWorkspaceMenuItemFactory },
    pin: { order: 2, menuItemFactory: PinWorkspaceMenuItemFactory },
    unpin: { order: 3, menuItemFactory: UnpinWorkspaceMenuItemFactory },
    close: { order: 4, menuItemFactory: CloseWorkspaceTabMenuItemFactory },
  },
};
