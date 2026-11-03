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
import type { IMenuButtonItem, IMenuSelectorItem, MenuSchemaType } from '@termlnk/ui';
import { ACP_SESSION_TYPE, IACPDiscoveryService, IACPSessionService } from '@termlnk/acp';
import { ICommandService, RxDisposable } from '@termlnk/core';
import {
  ITerminalUIService,
  ITerminalViewRegistry,
  OpenLocalTerminalCommand,
} from '@termlnk/terminal-ui';
import {
  IContextMenuService,
  IMenuManagerService,
  MenuItemType,
} from '@termlnk/ui';
import { map, takeUntil } from 'rxjs/operators';
import { NewACPSessionCommand } from '../commands/new-acp-session.command';
import { ACPSessionView } from '../views/session/ACPSessionView';

export const NEW_SESSION_MENU = 'acp-ui.context-menu.new-session';

/**
 * Registers the ACP session view, owns the tab-bar "+" menu, and keeps tab
 * status in sync with the main-process session service.
 */
export class ACPUIController extends RxDisposable {
  constructor(
    @ITerminalViewRegistry private readonly _viewRegistry: ITerminalViewRegistry,
    @ITerminalUIService private readonly _terminalUI: ITerminalUIService,
    @IACPSessionService private readonly _sessionService: IACPSessionService,
    @IACPDiscoveryService private readonly _discovery: IACPDiscoveryService,
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManager: IMenuManagerService,
    @IContextMenuService private readonly _contextMenuService: IContextMenuService
  ) {
    super();
    this._initCommands();
    this._initViews();
    this._initMenu();
    this._initAddSessionHandler();
    this._initStatusSync();
  }

  private _initCommands(): void {
    this.disposeWithMe(this._commandService.registerCommand(NewACPSessionCommand));
  }

  private _initViews(): void {
    this.disposeWithMe(this._viewRegistry.registerView(ACP_SESSION_TYPE, ACPSessionView));
  }

  private _initMenu(): void {
    const discovery = this._discovery;
    const schema: MenuSchemaType = {
      [NEW_SESSION_MENU]: {
        [OpenLocalTerminalCommand.id]: {
          order: 0,
          menuItemFactory: NewLocalTerminalMenuItemFactory,
        },
        'acp-ui.new-session.providers': {
          order: 10,
          menuItemFactory: () => ACPProviderMenuItemFactory(discovery),
        },
      },
    };
    this.disposeWithMe(this._menuManager.mergeMenu(schema));
  }

  private _initAddSessionHandler(): void {
    // Single-slot registry: acp-ui owns the "+" button. Keyboard ⌘N still goes
    // straight to OpenLocalTerminalCommand (no event → no menu).
    this.disposeWithMe(
      this._viewRegistry.registerAddSessionHandler((event) => {
        if (!event) {
          void this._commandService.executeCommand(OpenLocalTerminalCommand.id);
          return;
        }
        void this._discovery.refresh();
        this._contextMenuService.triggerContextMenu(event, NEW_SESSION_MENU);
      })
    );
  }

  private _initStatusSync(): void {
    this._sessionService.sessions$
      .pipe(takeUntil(this.dispose$))
      .subscribe((sessions) => {
        for (const info of sessions) {
          const tab = this._terminalUI.getSession(info.id);
          if (!tab) {
            continue;
          }
          const status = mapTabStatus(info.status);
          if (tab.status !== status) {
            this._terminalUI.updateSessionStatus(info.id, status);
          }
          if (info.title && tab.title !== info.title) {
            this._terminalUI.updateSessionTitle(info.id, info.title);
          }
        }
      });
  }
}

function NewLocalTerminalMenuItemFactory(_accessor: IAccessor): IMenuButtonItem {
  return {
    id: OpenLocalTerminalCommand.id,
    commandId: OpenLocalTerminalCommand.id,
    type: MenuItemType.BUTTON,
    title: 'acp-ui.new-session.local-terminal',
  };
}

function ACPProviderMenuItemFactory(discovery: IACPDiscoveryService): IMenuSelectorItem {
  return {
    id: 'acp-ui.new-session.providers',
    type: MenuItemType.SELECTOR,
    title: 'acp-ui.new-session.agents',
    selections: discovery.launchableProviders$.pipe(
      map((list) =>
        list.map((p) => ({
          value: p.descriptor.id,
          label: p.descriptor.title,
          params: { providerId: p.descriptor.id },
        }))
      )
    ),
    selectionsCommandId: NewACPSessionCommand.id,
  };
}

function mapTabStatus(
  status: string
): 'idle' | 'connecting' | 'ready' | 'error' | 'closed' {
  switch (status) {
    case 'connecting':
      return 'connecting';
    case 'ready':
    case 'streaming':
      return 'ready';
    case 'error':
      return 'error';
    case 'closed':
      return 'closed';
    default:
      return 'idle';
  }
}
