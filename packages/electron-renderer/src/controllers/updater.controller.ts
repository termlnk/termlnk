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

import { Disposable, Inject, Injector } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { IUpdaterService } from '@termlnk/electron';
import { BuiltInUIPart, ComponentManagerService, IUIPartsService } from '@termlnk/ui';
import { UpdateButton } from '../views/updater/UpdateButton';
import { UPDATE_DIALOG_COMPONENT_NAME, UpdateDialog } from '../views/updater/UpdateDialog';

export const UPDATE_DIALOG_ID = 'electron-renderer.updater.dialog';

export class UpdaterController extends Disposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @IUpdaterService private readonly _updaterService: IUpdaterService
  ) {
    super();
    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._componentManagerService.register(UPDATE_DIALOG_COMPONENT_NAME, UpdateDialog)
    );

    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.SIDE_TAB_BAR, () => connectInjector(UpdateButton, this._injector))
    );

    this._updaterService.checkForUpdates();
  }
}
