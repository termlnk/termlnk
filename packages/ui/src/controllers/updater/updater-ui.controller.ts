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

import { Disposable, ILogService, Inject, Injector, IUpdaterService } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { ComponentManagerService } from '../../services/component/component-manager.service';
import { BuiltInUIPart, IUIPartsService } from '../../services/parts/parts.service';
import { UpdateButton } from '../../views/updater/UpdateButton';
import { UpdateDialog } from '../../views/updater/UpdateDialog';
import { UPDATE_DIALOG_COMPONENT_NAME } from '../../views/updater/updater-constants';

export class UpdaterUIController extends Disposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @IUpdaterService private readonly _updaterService: IUpdaterService,
    @ILogService private readonly _logService: ILogService
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

    void this._updaterService.checkForUpdates().catch((err) => {
      // Web shells throw NOT_SUPPORTED on download/install, but checkForUpdates
      // should resolve cleanly. Log unexpected failures (network, rate limit)
      // without crashing — UI surfaces the error via status$ → UpdateDialog.
      this._logService.warn('[UpdaterUIController] initial checkForUpdates failed:', err);
    });
  }
}
