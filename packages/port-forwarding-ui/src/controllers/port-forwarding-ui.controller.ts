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
import { ComponentManagerService, IMenuManagerService } from '@termlnk/ui';
import { ArrowRightLeft } from 'lucide-react';
import { CreateRuleCommand } from '../commands/create-rule.command';
import { DeleteRuleCommand, EditRuleCommand } from '../commands/edit-rule.command';
import { StartRuleCommand } from '../commands/start-rule.command';
import { RestartRuleCommand, StopRuleCommand } from '../commands/stop-rule.command';
import { ToggleForwardingPanelCommand } from '../commands/toggle-forwarding-panel.command';
import { PortForwardingExplorer } from '../views/PortForwardingExplorer';
import { PORT_FORWARDING_EXPLORER_NAME, PORT_FORWARDING_ICON_NAME } from './component-names';
import { portForwardingMenuSchema } from './menu.schema';

export class PortForwardingUIController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
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
    this.disposeWithMe(this._componentManagerService.register(PORT_FORWARDING_ICON_NAME, ArrowRightLeft));
    this.disposeWithMe(
      this._componentManagerService.register(
        PORT_FORWARDING_EXPLORER_NAME,
        connectInjector(PortForwardingExplorer, this._injector)
      )
    );
  }

  private _initCommands(): void {
    [
      ToggleForwardingPanelCommand,
      CreateRuleCommand,
      StartRuleCommand,
      StopRuleCommand,
      RestartRuleCommand,
      EditRuleCommand,
      DeleteRuleCommand,
    ].forEach((command) => this.disposeWithMe(this._commandService.registerCommand(command)));
  }

  private _initMenus(): void {
    this._menuManagerService.mergeMenu(portForwardingMenuSchema);
  }
}
