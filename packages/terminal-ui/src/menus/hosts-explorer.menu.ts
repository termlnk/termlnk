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
import { DeleteHostCommand } from '../commands/delete-host.command';
import { NewGroupCommand } from '../commands/new-group.command';
import { NewHostCommand } from '../commands/new-host.command';
import { RenameHostCommand } from '../commands/rename-host.command';
import { HOSTS_EXPLORER_BLANK_MENU, HOSTS_EXPLORER_FOLDER_ITEM_MENU, HOSTS_EXPLORER_HOST_ITEM_MENU } from '../services/hosts-explorer/contextmenu-positions';
import { IHostExplorerService } from '../services/hosts-explorer/hosts-explorer.service';

export function NewHostMenuItemFactory(_accessor: IAccessor): IMenuItem {
  return {
    id: 'terminal-ui.hosts-explorer.context-menu.new-host',
    commandId: NewHostCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.hosts-explorer.add-host',
  };
}

export function NewGroupMenuItemFactory(_accessor: IAccessor): IMenuItem {
  return {
    id: 'terminal-ui.hosts-explorer.context-menu.new-group',
    commandId: NewGroupCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.hosts-explorer.add-group',
  };
}

export function RenameMenuItemFactory(accessor: IAccessor): IMenuItem {
  const hostExplorerService = accessor.get(IHostExplorerService);
  return {
    id: 'terminal-ui.hosts-explorer.context-menu.rename',
    commandId: RenameHostCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.hosts-explorer.context-menu.rename',
    disabled$: hostExplorerService.focusedHost$.pipe(map((host) => !host)),
  };
}

export function DeleteMenuItemFactory(accessor: IAccessor): IMenuItem {
  const hostExplorerService = accessor.get(IHostExplorerService);
  return {
    id: 'terminal-ui.hosts-explorer.context-menu.delete',
    commandId: DeleteHostCommand.id,
    type: MenuItemType.BUTTON,
    title: 'terminal-ui.hosts-explorer.context-menu.delete',
    disabled$: hostExplorerService.focusedHost$.pipe(map((host) => !host)),
  };
}

export const hostsExplorerMenuSchema: MenuSchemaType = {
  [HOSTS_EXPLORER_HOST_ITEM_MENU]: {
    rename: { order: 0, menuItemFactory: RenameMenuItemFactory },
    delete: { order: 1, menuItemFactory: DeleteMenuItemFactory },
  },
  [HOSTS_EXPLORER_FOLDER_ITEM_MENU]: {
    rename: { order: 0, menuItemFactory: RenameMenuItemFactory },
    delete: { order: 1, menuItemFactory: DeleteMenuItemFactory },
  },
  [HOSTS_EXPLORER_BLANK_MENU]: {
    'new-host': { order: 0, menuItemFactory: NewHostMenuItemFactory },
    'new-group': { order: 1, menuItemFactory: NewGroupMenuItemFactory },
  },
};
