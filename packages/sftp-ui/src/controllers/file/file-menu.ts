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
import type { IMenuButtonItem, MenuSchemaType } from '@termlnk/ui';
import { MenuItemType } from '@termlnk/ui';
import { map } from 'rxjs';
import { FileActionCommand } from '../../commands/file/file-action.command';
import { FileContextService } from '../../services/file-context/file-context.service';

/** Right-click menu on a remote file entry. */
export const SFTP_FILE_MENU = 'sftp-ui.context-menu.file';

function downloadFactory(): IMenuButtonItem {
  return {
    id: 'sftp-ui.file-menu.download',
    commandId: FileActionCommand.id,
    params: { action: 'download' },
    type: MenuItemType.BUTTON,
    title: 'sftp-ui.action.download',
  };
}

function downloadToBrowserFactory(accessor: IAccessor): IMenuButtonItem {
  const service = accessor.get(FileContextService);
  return {
    id: 'sftp-ui.file-menu.download-to-browser',
    commandId: FileActionCommand.id,
    params: { action: 'downloadToBrowser' },
    type: MenuItemType.BUTTON,
    title: 'sftp-ui.action.downloadToBrowser',
    // Hidden unless the pane provided this capability (web shell only).
    hidden$: service.target$.pipe(map((t) => !t?.actions.downloadToBrowser)),
    disabled$: service.target$.pipe(map((t) => t?.entry.isDirectory ?? false)),
  };
}

function renameFactory(): IMenuButtonItem {
  return {
    id: 'sftp-ui.file-menu.rename',
    commandId: FileActionCommand.id,
    params: { action: 'rename' },
    type: MenuItemType.BUTTON,
    title: 'sftp-ui.action.rename',
  };
}

function permissionsFactory(): IMenuButtonItem {
  return {
    id: 'sftp-ui.file-menu.permissions',
    commandId: FileActionCommand.id,
    params: { action: 'permissions' },
    type: MenuItemType.BUTTON,
    title: 'sftp-ui.action.permissions',
  };
}

function deleteFactory(): IMenuButtonItem {
  return {
    id: 'sftp-ui.file-menu.delete',
    commandId: FileActionCommand.id,
    params: { action: 'delete' },
    type: MenuItemType.BUTTON,
    title: 'sftp-ui.action.delete',
  };
}

export const fileMenuSchema: MenuSchemaType = {
  [SFTP_FILE_MENU]: {
    'sftp-ui.file-menu.download': { order: 0, menuItemFactory: downloadFactory },
    'sftp-ui.file-menu.download-to-browser': { order: 1, menuItemFactory: downloadToBrowserFactory },
    'sftp-ui.file-menu.rename': { order: 2, menuItemFactory: renameFactory },
    'sftp-ui.file-menu.permissions': { order: 3, menuItemFactory: permissionsFactory },
    'sftp-ui.file-menu.delete': { order: 4, menuItemFactory: deleteFactory },
  },
};
