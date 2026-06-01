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

import type { IConfirmService, IDisposable } from '@termlnk/core';
import type { IConfirmPartOptions } from '../../views/components/confirm-part/interface';
import { Disposable, Inject, Injector, toDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { Subject } from 'rxjs';
import { ConfirmPart } from '../../views/components/confirm-part/ConfirmPart';
import { BuiltInUIPart, IUIPartsService } from '../parts/parts.service';

export class DesktopConfirmService extends Disposable implements IConfirmService<IConfirmPartOptions> {
  private _confirmOptions: IConfirmPartOptions[] = [];

  private readonly _confirmOptions$ = new Subject<IConfirmPartOptions[]>();
  readonly confirmOptions$ = this._confirmOptions$.asObservable();

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService
  ) {
    super();

    this._init();
  }

  override dispose(): void {
    super.dispose();

    this._confirmOptions = [];
    this._confirmOptions$.complete();
  }

  open(option: IConfirmPartOptions): IDisposable {
    if (this._confirmOptions.some((item) => item.id === option.id)) {
      this._confirmOptions = this._confirmOptions.map((item) => ({
        ...(item.id === option.id ? option : item),
        visible: item.id === option.id ? true : item.visible,
      }));
    } else {
      this._confirmOptions.push({
        ...option,
        visible: true,
      });
    }

    this._confirmOptions$.next(this._confirmOptions);

    return toDisposable(() => {
      this._confirmOptions = this._confirmOptions.filter((item) => item.id !== option.id);
      this._confirmOptions$.next([...this._confirmOptions]);
    });
  }

  confirm(params: IConfirmPartOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const disposeHandler = this.open({
        ...params,
        onConfirm: () => {
          disposeHandler.dispose();
          resolve(true);
        },
        onCancel: () => {
          disposeHandler.dispose();
          resolve(false);
        },
      });
    });
  }

  close(id: string): void {
    this._confirmOptions = this._confirmOptions.map((item) => ({
      ...item,
      visible: item.id === id ? false : item.visible,
    }));

    this._confirmOptions$.next([...this._confirmOptions]);
  }

  private _init(): void {
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.GLOBAL, () => connectInjector(ConfirmPart, this._injector))
    );
  }
}
