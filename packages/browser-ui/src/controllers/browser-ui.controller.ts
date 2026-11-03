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

import { ICommandService, Inject, Injector, RxDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { IShortcutService, ISidePanelService, KeyCode, MetaKeys } from '@termlnk/ui';
import { FocusBrowserAddressCommand } from '../commands/focus-browser-address.command';
import { ToggleBrowserPanelCommand } from '../commands/toggle-browser-panel.command';
import { BROWSER_FOCUSED_CONTEXT, BROWSER_PANEL_ID } from '../common/constants';
import { BrowserPanel } from '../views/BrowserPanel';

export class BrowserUIController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ISidePanelService private readonly _sidePanelService: ISidePanelService,
    @ICommandService private readonly _commandService: ICommandService,
    @IShortcutService private readonly _shortcutService: IShortcutService
  ) {
    super();
    this._initPanel();
    this._initCommands();
    this._initShortcuts();
  }

  private _initPanel(): void {
    this.disposeWithMe(
      this._sidePanelService.registerPanel({
        id: BROWSER_PANEL_ID,
        icon: 'globe',
        titleKey: 'browser-ui.panel.title',
        component: connectInjector(BrowserPanel, this._injector),
        order: 30,
      })
    );
  }

  private _initCommands(): void {
    this.disposeWithMe(this._commandService.registerCommand(ToggleBrowserPanelCommand));
    this.disposeWithMe(this._commandService.registerCommand(FocusBrowserAddressCommand));
  }

  private _initShortcuts(): void {
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: ToggleBrowserPanelCommand.id,
      description: 'browser-ui.shortcuts.toggle',
      binding: KeyCode.B | MetaKeys.CTRL_COMMAND | MetaKeys.ALT,
    }));
    // ⌘F — focus address bar when browser panel is focused.
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: FocusBrowserAddressCommand.id,
      description: 'browser-ui.shortcuts.find',
      binding: KeyCode.F | MetaKeys.CTRL_COMMAND,
      priority: 30,
      preconditions: (ctx) => ctx.getContextValue(BROWSER_FOCUSED_CONTEXT),
    }));
  }
}
