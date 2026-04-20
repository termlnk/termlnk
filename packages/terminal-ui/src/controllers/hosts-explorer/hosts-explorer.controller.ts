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
import { ComponentManagerService } from '@termlnk/ui';
import { ConnectHostCommand } from '../../commands/connect-host.command';
import { ToggleHostsPanelCommand } from '../../commands/toggle-hosts-panel.command';
import { HOSTS_EXPLORER_NAME } from '../../views/hosts-explorer/component-name';
import { HostExplorer } from '../../views/hosts-explorer/HostExplorer';

export class HostsExplorerController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
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
    ].forEach((command) => this.disposeWithMe(this._commandService.registerCommand(command)));
  }
}
