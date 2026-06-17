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

import type { MenuSchemaType } from '@termlnk/ui';
import { MenuPosition } from '@termlnk/ui';
import { DuplicateSnippetCommand } from '../commands/duplicate-snippet.command';
import { DeleteSnippetCommand, EditSnippetCommand } from '../commands/edit-snippet.command';
import { DeletePackageCommand, RenamePackageCommand } from '../commands/package.command';
import { RunSnippetCommand } from '../commands/run-snippet.command';
import { ToggleSnippetsPanelCommand } from '../commands/toggle-snippets-panel.command';
import { DeletePackageMenuFactory, DeleteSnippetMenuFactory, DuplicateSnippetMenuFactory, EditSnippetMenuFactory, PACKAGE_CONTEXT_MENU, RenamePackageMenuFactory, RunSnippetMenuFactory, SNIPPET_CONTEXT_MENU } from './snippet-context.menu';
import { snippetsMenuFactory } from './snippets.menu';

export const snippetsExplorerMenuSchema: MenuSchemaType = {
  [MenuPosition.SIDE_TAB_BAR]: {
    [ToggleSnippetsPanelCommand.id]: {
      order: 9,
      menuItemFactory: snippetsMenuFactory,
    },
  },
  [SNIPPET_CONTEXT_MENU]: {
    [RunSnippetCommand.id]: { order: 0, menuItemFactory: RunSnippetMenuFactory },
    [EditSnippetCommand.id]: { order: 1, menuItemFactory: EditSnippetMenuFactory },
    [DuplicateSnippetCommand.id]: { order: 2, menuItemFactory: DuplicateSnippetMenuFactory },
    [DeleteSnippetCommand.id]: { order: 3, menuItemFactory: DeleteSnippetMenuFactory },
  },
  [PACKAGE_CONTEXT_MENU]: {
    [RenamePackageCommand.id]: { order: 0, menuItemFactory: RenamePackageMenuFactory },
    [DeletePackageCommand.id]: { order: 1, menuItemFactory: DeletePackageMenuFactory },
  },
};
