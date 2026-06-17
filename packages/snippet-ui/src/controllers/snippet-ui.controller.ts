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

import { Disposable, ICommandService, Inject } from '@termlnk/core';
import { ComponentManagerService, IMenuManagerService } from '@termlnk/ui';
import { Braces } from 'lucide-react';
import { CreateSnippetCommand } from '../commands/create-snippet.command';
import { DuplicateSnippetCommand } from '../commands/duplicate-snippet.command';
import { DeleteSnippetCommand, EditSnippetCommand } from '../commands/edit-snippet.command';
import { DeletePackageCommand, RenamePackageCommand } from '../commands/package.command';
import { RunSnippetCommand } from '../commands/run-snippet.command';
import { ToggleSnippetsPanelCommand } from '../commands/toggle-snippets-panel.command';
import { SNIPPETS_EXPLORER_NAME, SNIPPETS_ICON_KEY } from '../common/constants';
import { SnippetsExplorer } from '../views/SnippetsExplorer';
import { snippetsExplorerMenuSchema } from './menu.schema';

export class SnippetUIController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService
  ) {
    super();
    this._initComponents();
    this._initCommands();
    this._initMenus();
  }

  private _initComponents(): void {
    this.disposeWithMe(this._componentManagerService.register(SNIPPETS_ICON_KEY, Braces));
    this.disposeWithMe(this._componentManagerService.register(SNIPPETS_EXPLORER_NAME, SnippetsExplorer));
  }

  private _initCommands(): void {
    [
      ToggleSnippetsPanelCommand,
      CreateSnippetCommand,
      RunSnippetCommand,
      EditSnippetCommand,
      DuplicateSnippetCommand,
      DeleteSnippetCommand,
      RenamePackageCommand,
      DeletePackageCommand,
    ].forEach((command) =>
      this.disposeWithMe(this._commandService.registerCommand(command))
    );
  }

  private _initMenus(): void {
    this.disposeWithMe(this._menuManagerService.appendRootMenu(snippetsExplorerMenuSchema));
  }
}
