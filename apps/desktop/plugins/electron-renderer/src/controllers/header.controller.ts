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
import { BuiltInUIPart, IUIPartsService } from '@termlnk/ui';
import { DesktopHeader } from '../views/DesktopHeader';

export class HeaderController extends Disposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService
  ) {
    super();

    this._init();
  }

  private _init() {
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.HEADER, () => connectInjector(DesktopHeader, this._injector))
    );
  }
}
