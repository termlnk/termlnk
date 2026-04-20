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
import { BuiltInUIPart, ComponentManagerService, IDialogService, IShortcutService, IUIPartsService } from '@termlnk/ui';
import { ToggleSettingsCommand } from '../../commands/toggle-settings.command';
import { SettingsService } from '../../services/settings/settings.service';
import { SETTINGS_PANEL_COMPONENT_NAME, SettingsPanel } from '../../views/settings-panel';
import { SettingsButton } from '../../views/SettingsButton';
import { ToggleSettingsShortcut } from './shortcut';

export const SETTINGS_DIALOG_ID = 'settings-ui.settings.dialog';

export class SettingsController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IShortcutService private readonly _shortcutService: IShortcutService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(SettingsService) private readonly _settingsService: SettingsService
  ) {
    super();
    this._init();
  }

  private _init() {
    this.disposeWithMe(
      this._componentManagerService.register(SETTINGS_PANEL_COMPONENT_NAME, SettingsPanel)
    );

    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.SIDE_TAB_BAR, () => SettingsButton)
    );

    this.disposeWithMe(
      this._settingsService.stateUpdate$.subscribe((newState) => {
        if (newState.open === true) {
          this._openSettingsDialog();
        } else if (newState.open === false) {
          this._closeSettingsDialog();
        }
      })
    );

    this.disposeWithMe(this._commandService.registerCommand(ToggleSettingsCommand));
    this.disposeWithMe(this._shortcutService.registerShortcut(ToggleSettingsShortcut));
  }

  private _openSettingsDialog() {
    this._dialogService.open({
      id: SETTINGS_DIALOG_ID,
      draggable: true,
      width: 960,
      className: 'tm:overflow-hidden',
      mask: false,
      disableAutoFocus: true,
      style: {
        maxHeight: 'calc(100vh - 40px)',
      },
      title: { title: this._localeService.t('settings-ui.title') },
      children: { componentId: SETTINGS_PANEL_COMPONENT_NAME },
      onClose: () => this._settingsService.terminate(),
    });
  }

  private _closeSettingsDialog() {
    this._dialogService.close(SETTINGS_DIALOG_ID);
  }
}
