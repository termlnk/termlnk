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

import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IDialogPartOptions } from '../../views/components/dialog-part/DialogPart';
import { createIdentifier, Disposable, Inject, Injector, toDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { Subject } from 'rxjs';
import { DialogPart } from '../../views/components/dialog-part/DialogPart';
import { BuiltInUIPart, IUIPartsService } from '../parts/parts.service';

export interface IDialogService {
  readonly dialogOptions$: Observable<IDialogPartOptions[]>;

  open(params: IDialogPartOptions): IDisposable;
  close(id: string): void;
  closeAll(expectIds?: string[]): void;
}
export const IDialogService = createIdentifier<IDialogService>('ui.dialog-service');

export class DialogService extends Disposable implements IDialogService {
  protected _dialogOptions: IDialogPartOptions[] = [];

  protected readonly _dialogOptions$ = new Subject<IDialogPartOptions[]>();
  readonly dialogOptions$ = this._dialogOptions$.asObservable();

  constructor(
    @Inject(Injector) protected readonly _injector: Injector,
    @IUIPartsService protected readonly _uiPartsService: IUIPartsService
  ) {
    super();

    this._init();
  }

  protected _init(): void {
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.GLOBAL, () => connectInjector(DialogPart, this._injector))
    );
  }

  override dispose(): void {
    super.dispose();

    this._dialogOptions = [];
    this._dialogOptions$.complete();
  }

  open(option: IDialogPartOptions): IDisposable {
    if (this._dialogOptions.some((item) => item.id === option.id)) {
      this._dialogOptions = this._dialogOptions.map((item) => ({
        ...(item.id === option.id ? option : item),
        open: item.id === option.id ? true : item.open,
      }));
    } else {
      this._dialogOptions.push({
        ...option,
        open: true,
      });
    }

    this._dialogOptions$.next(this._dialogOptions);

    return toDisposable(() => {
      this._dialogOptions = [];
      this._dialogOptions$.next([]);
    });
  }

  close(id: string) {
    this._dialogOptions = this._dialogOptions.map((item) => ({
      ...item,
      open: item.id === id ? false : item.open,
    }));

    this._dialogOptions$.next([...this._dialogOptions]);
  }

  closeAll(expectIds?: string[]): void {
    const expectIdSet = new Set(expectIds);
    this._dialogOptions = this._dialogOptions.map((item) => ({
      ...item,
      open: expectIdSet.has(item.id) ? item.open : false,
    }));
    this._dialogOptions$.next([...this._dialogOptions]);
  }
}
