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

import { Disposable, ICommandService, Inject, LocaleService } from '@termlnk/core';
import { ComponentManagerService, IDialogService, IShortcutService } from '@termlnk/ui';
import { ToggleHostDialogCommand } from '../../commands/toggle-host-dialog.command';
import { HostDialogService } from '../../services/host-dialog/host-dialog.service';
import { HOST_DIALOG_COMPONENT_NAME, HostDialog } from '../../views/host-dialog';
import { ToggleHostDialogShortcut } from './shortcut';

export const HOST_DIALOG_ID = 'terminal-ui.host.dialog';

export class HostDialogController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IShortcutService private readonly _shortcutService: IShortcutService,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(HostDialogService) private readonly _hostDialogService: HostDialogService
  ) {
    super();

    this._init();
  }

  private _init() {
    this.disposeWithMe(this._componentManagerService.register(HOST_DIALOG_COMPONENT_NAME, HostDialog));

    this.disposeWithMe(
      this._hostDialogService.stateUpdate$.subscribe((newState) => {
        if (newState.open === true) {
          this._openHostDialog();
        } else if (newState.open === false) {
          this._closeHostDialog();
        }
      })
    );

    this.disposeWithMe(this._commandService.registerCommand(ToggleHostDialogCommand));
    this.disposeWithMe(this._shortcutService.registerShortcut(ToggleHostDialogShortcut));
  }

  private _openHostDialog() {
    const state = this._hostDialogService.state;
    const mode = state.mode;

    this._dialogService.open({
      id: HOST_DIALOG_ID,
      draggable: true,
      width: 600,
      title: { title: this._localeService.t(`terminal-ui.host-dialog.title.${mode}`) },
      children: { componentId: HOST_DIALOG_COMPONENT_NAME },
      onClose: () => this._hostDialogService.terminate(),
    });
  }

  private _closeHostDialog() {
    this._dialogService.close(HOST_DIALOG_ID);
  }
}
