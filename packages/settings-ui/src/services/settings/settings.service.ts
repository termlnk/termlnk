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

import type { Observable } from 'rxjs';
import type { ISettingsState } from '../../models/settings.state';
import { Disposable } from '@termlnk/core';
import { SettingsStateModel, SettingsTab } from '../../models/settings.state';

export class SettingsService extends Disposable {
  private readonly _model = new SettingsStateModel();

  get stateUpdate$(): Observable<Partial<ISettingsState>> {
    return this._model.stateUpdate$;
  }

  get state$(): Observable<ISettingsState> {
    return this._model.state$;
  }

  get state(): ISettingsState {
    return this._model.state;
  }

  start(options?: Partial<ISettingsState>): void {
    this._model.changeState({
      open: true,
      activeTab: SettingsTab.APPEARANCE,
      ...options,
    });
  }

  setActiveTab(tab: SettingsTab): void {
    this._model.changeState({ activeTab: tab });
  }

  changeState(newState: Partial<ISettingsState>): void {
    this._model.changeState(newState);
  }

  terminate(): void {
    this._model.changeState({ open: false });
  }
}
