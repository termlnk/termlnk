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
import { ComponentManagerService, IMenuManagerService, IShortcutService, KeyCode, MetaKeys } from '@termlnk/ui';
import { ConnectHostCommand } from '../../commands/connect-host.command';
import { DeleteHostCommand } from '../../commands/delete-host.command';
import { NewGroupCommand } from '../../commands/new-group.command';
import { NewHostCommand } from '../../commands/new-host.command';
import { RenameHostCommand } from '../../commands/rename-host.command';
import { ToggleHostsPanelCommand } from '../../commands/toggle-hosts-panel.command';
import { hostsExplorerMenuSchema } from '../../menus/hosts-explorer.menu';
import { HOSTS_EXPLORER_FOCUSED_CONTEXT } from '../../services/hosts-explorer/contextmenu-positions';
import { HOSTS_EXPLORER_NAME } from '../../views/hosts-explorer/component-name';
import { HostExplorer } from '../../views/hosts-explorer/HostExplorer';

export class HostsExplorerController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @IShortcutService private readonly _shortcutService: IShortcutService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService
  ) {
    super();

    this._init();
  }

  private _init() {
    ([
      [HOSTS_EXPLORER_NAME, HostExplorer],
    ] as const).forEach(([key, component]) => this.disposeWithMe(this._componentManagerService.register(key, component)));

    [
      ToggleHostsPanelCommand,
      ConnectHostCommand,
      DeleteHostCommand,
      RenameHostCommand,
      NewHostCommand,
      NewGroupCommand,
    ].forEach((command) => this.disposeWithMe(this._commandService.registerCommand(command)));

    this.disposeWithMe(this._menuManagerService.appendRootMenu(hostsExplorerMenuSchema));

    // macOS uses Cmd+Backspace (no physical Delete key); Windows/Linux use
    // bare Delete. Skip when an editable element is focused so rename inputs
    // keep their native backspace behaviour.
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: DeleteHostCommand.id,
      binding: KeyCode.DELETE,
      mac: KeyCode.BACKSPACE | MetaKeys.CTRL_COMMAND,
      preconditions: (ctx) => {
        if (!ctx.getContextValue(HOSTS_EXPLORER_FOCUSED_CONTEXT)) {
          return false;
        }
        const active = document.activeElement as HTMLElement | null;
        const tag = active?.tagName;
        return tag !== 'INPUT' && tag !== 'TEXTAREA' && !active?.isContentEditable;
      },
    }));
  }
}
