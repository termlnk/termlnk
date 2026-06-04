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

import { ICommandService, Inject, RxDisposable } from '@termlnk/core';
import { ComponentManagerService, IMenuManagerService } from '@termlnk/ui';
import { KeyRound } from 'lucide-react';
import { GenerateKeyCommand, NewIdentityCommand, NewKeyCommand } from '../../commands/keychain/keychain.command';
import { ToggleKeychainPanelCommand } from '../../commands/toggle-keychain-panel.command';
import { KeychainExplorer } from '../../views/keychain/KeychainExplorer';
import { KEYCHAIN_EXPLORER_NAME, KEYCHAIN_ICON_NAME } from './component-names';
import { menuSchema } from './menu.schema';

export class KeychainController extends RxDisposable {
  constructor(
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService
  ) {
    super();

    this._initComponents();
    this._initCommands();
    this._initMenus();
  }

  private _initComponents(): void {
    this.disposeWithMe(this._componentManagerService.register(KEYCHAIN_ICON_NAME, KeyRound));
    this.disposeWithMe(this._componentManagerService.register(KEYCHAIN_EXPLORER_NAME, KeychainExplorer));
  }

  private _initCommands(): void {
    [
      ToggleKeychainPanelCommand,
      GenerateKeyCommand,
      NewKeyCommand,
      NewIdentityCommand,
    ].forEach((command) => this.disposeWithMe(this._commandService.registerCommand(command)));
  }

  private _initMenus(): void {
    this._menuManagerService.mergeMenu(menuSchema);
  }
}
