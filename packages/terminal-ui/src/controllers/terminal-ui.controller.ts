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
import { connectInjector, FilesIcon, FilesIconKey } from '@termlnk/design';
import { BuiltInUIPart, ComponentManagerService, IMenuManagerService, IShortcutService, IUIPartsService, KeyCode, MetaKeys } from '@termlnk/ui';
import { ApplyErrorFixCommand } from '../commands/apply-error-fix.command';
import { OpenLocalTerminalCommand } from '../commands/open-local-terminal.command';
import { ToggleTabListCommand } from '../commands/toggle-tab-list.command';
import { ToggleTerminalSearchCommand } from '../commands/toggle-terminal-search.command';
import { TERMINAL_FOCUSED_CONTEXT } from '../common/context-keys';
import { ITerminalViewRegistry } from '../services/terminal/terminal-view-registry.service';
import { LocalTerminalView } from '../views/local-terminal/LocalTerminalView';
import { TerminalContainer } from '../views/terminal-container/TerminalContainer';
import { TabListDropdownPart } from '../views/terminal-tabs/TabListDropdownPart';
import { TerminalTabBar } from '../views/terminal-tabs/TerminalTabBar';
import { TerminalView } from '../views/terminal/Terminal';
import { menuSchema } from './menu.schema';

export class TerminalUIController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @IShortcutService private readonly _shortcutService: IShortcutService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @ITerminalViewRegistry private readonly _viewRegistry: ITerminalViewRegistry
  ) {
    super();

    this._initComponents();
    this._initCommands();
    this._initShortcuts();
    this._initMenus();
    this._initViews();
  }

  private _initComponents() {
    this.disposeWithMe(this._componentManagerService.register(FilesIconKey, FilesIcon));
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.CONTENT, () => connectInjector(TerminalContainer, this._injector))
    );
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.TAB_BAR, () => connectInjector(TerminalTabBar, this._injector))
    );
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.FLOATING, () => connectInjector(TabListDropdownPart, this._injector))
    );
  }

  private _initCommands(): void {
    this.disposeWithMe(this._commandService.registerCommand(ToggleTabListCommand));
    this.disposeWithMe(this._commandService.registerCommand(OpenLocalTerminalCommand));
    this.disposeWithMe(this._commandService.registerCommand(ApplyErrorFixCommand));
    this.disposeWithMe(this._commandService.registerCommand(ToggleTerminalSearchCommand));
  }

  private _initShortcuts(): void {
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: OpenLocalTerminalCommand.id,
      description: 'terminal-ui.shortcuts.open-local-terminal',
      binding: KeyCode.N | MetaKeys.CTRL_COMMAND,
    }));
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: ApplyErrorFixCommand.id,
      description: 'terminal-ui.shortcuts.apply-error-fix',
      binding: KeyCode.E | MetaKeys.CTRL_COMMAND | MetaKeys.SHIFT,
    }));
    // ⌘F — multi-candidate with explorer/browser (higher priority elsewhere).
    // priority 10 is the terminal fallback when a terminal pane is focused.
    this.disposeWithMe(this._shortcutService.registerShortcut({
      id: ToggleTerminalSearchCommand.id,
      description: 'terminal-ui.shortcuts.toggle-search',
      binding: KeyCode.F | MetaKeys.CTRL_COMMAND,
      priority: 10,
      preconditions: (ctx) => ctx.getContextValue(TERMINAL_FOCUSED_CONTEXT),
    }));
  }

  private _initMenus(): void {
    this._menuManagerService.mergeMenu(menuSchema);
  }

  private _initViews(): void {
    this.disposeWithMe(this._viewRegistry.registerView('ssh', TerminalView));
    this.disposeWithMe(this._viewRegistry.registerView('local', LocalTerminalView));

    // Default "+" handler opens a local terminal. ACPUIPlugin replaces this
    // slot with a dropdown menu when registered; identity-guarded dispose keeps
    // that override intact if TerminalUIController is disposed first.
    this.disposeWithMe(this._viewRegistry.registerAddSessionHandler(() => {
      void this._commandService.executeCommand(OpenLocalTerminalCommand.id);
    }));
  }
}
