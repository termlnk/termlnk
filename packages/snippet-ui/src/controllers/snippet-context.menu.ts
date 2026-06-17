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
import type { IMenuButtonItem } from '@termlnk/ui';
import { MenuItemType } from '@termlnk/ui';
import { map } from 'rxjs';
import { DuplicateSnippetCommand } from '../commands/duplicate-snippet.command';
import { DeleteSnippetCommand, EditSnippetCommand } from '../commands/edit-snippet.command';
import { DeletePackageCommand, RenamePackageCommand } from '../commands/package.command';
import { RunSnippetCommand } from '../commands/run-snippet.command';
import { ISnippetContextService } from '../services/snippet-context/snippet-context.service';

export const SNIPPET_CONTEXT_MENU = 'snippet-ui.context-menu.snippet';
export const PACKAGE_CONTEXT_MENU = 'snippet-ui.context-menu.package';

export function RunSnippetMenuFactory(accessor: IAccessor): IMenuButtonItem {
  const ctx = accessor.get(ISnippetContextService);
  return {
    id: RunSnippetCommand.id,
    commandId: RunSnippetCommand.id,
    type: MenuItemType.BUTTON,
    title: 'snippet-ui.contextMenu.run',
    disabled$: ctx.target$.pipe(map((t) => !t?.targetHostIds?.length)),
  };
}

export function EditSnippetMenuFactory(): IMenuButtonItem {
  return {
    id: EditSnippetCommand.id,
    commandId: EditSnippetCommand.id,
    type: MenuItemType.BUTTON,
    title: 'snippet-ui.contextMenu.edit',
  };
}

export function DuplicateSnippetMenuFactory(): IMenuButtonItem {
  return {
    id: DuplicateSnippetCommand.id,
    commandId: DuplicateSnippetCommand.id,
    type: MenuItemType.BUTTON,
    title: 'snippet-ui.contextMenu.duplicate',
  };
}

export function DeleteSnippetMenuFactory(): IMenuButtonItem {
  return {
    id: DeleteSnippetCommand.id,
    commandId: DeleteSnippetCommand.id,
    type: MenuItemType.BUTTON,
    title: 'snippet-ui.contextMenu.delete',
  };
}

export function RenamePackageMenuFactory(): IMenuButtonItem {
  return {
    id: RenamePackageCommand.id,
    commandId: RenamePackageCommand.id,
    type: MenuItemType.BUTTON,
    title: 'snippet-ui.contextMenu.rename',
  };
}

export function DeletePackageMenuFactory(): IMenuButtonItem {
  return {
    id: DeletePackageCommand.id,
    commandId: DeletePackageCommand.id,
    type: MenuItemType.BUTTON,
    title: 'snippet-ui.contextMenu.deletePackage',
  };
}
