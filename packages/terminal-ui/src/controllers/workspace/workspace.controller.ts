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

import { Disposable, ICommandService } from '@termlnk/core';
import { IMenuManagerService, IShortcutService } from '@termlnk/ui';
import { CloseActiveTabCommand } from '../../commands/close-active-tab.command';
import { CloseWorkspaceTabCommand } from '../../commands/close-workspace-tab.command';
import { CustomizeWorkspaceIconCommand } from '../../commands/customize-workspace-icon.command';
import { MaximizeSessionCommand } from '../../commands/maximize-session.command';
import { RenameWorkspaceCommand } from '../../commands/rename-workspace.command';
import { SelectTabByIndexCommand } from '../../commands/select-tab-by-index.command';
import { SplitSessionCommand } from '../../commands/split-session.command';
import { TogglePinWorkspaceCommand } from '../../commands/toggle-pin-workspace.command';
import { terminalTabMenuSchema } from '../../menus/terminal-tab.menu';
import {
  CloseActiveTabShortcut,
  MaximizeSessionShortcut,
  SelectTabByIndexShortcuts,
  SplitDownShortcut,
  SplitRightShortcut,
} from './shortcut';

export class WorkspaceController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @IShortcutService private readonly _shortcutService: IShortcutService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this.disposeWithMe(this._commandService.registerCommand(CloseActiveTabCommand));
    this.disposeWithMe(this._commandService.registerCommand(MaximizeSessionCommand));
    this.disposeWithMe(this._commandService.registerCommand(SplitSessionCommand));
    this.disposeWithMe(this._commandService.registerCommand(SelectTabByIndexCommand));
    this.disposeWithMe(this._commandService.registerCommand(CustomizeWorkspaceIconCommand));
    this.disposeWithMe(this._commandService.registerCommand(RenameWorkspaceCommand));
    this.disposeWithMe(this._commandService.registerCommand(TogglePinWorkspaceCommand));
    this.disposeWithMe(this._commandService.registerCommand(CloseWorkspaceTabCommand));

    this.disposeWithMe(this._menuManagerService.appendRootMenu(terminalTabMenuSchema));

    this.disposeWithMe(this._shortcutService.registerShortcut(CloseActiveTabShortcut));
    this.disposeWithMe(this._shortcutService.registerShortcut(MaximizeSessionShortcut));
    this.disposeWithMe(this._shortcutService.registerShortcut(SplitRightShortcut));
    this.disposeWithMe(this._shortcutService.registerShortcut(SplitDownShortcut));
    for (const shortcut of SelectTabByIndexShortcuts) {
      this.disposeWithMe(this._shortcutService.registerShortcut(shortcut));
    }
  }
}
