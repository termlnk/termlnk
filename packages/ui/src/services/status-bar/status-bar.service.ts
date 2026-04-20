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
import { createIdentifier, Disposable, Inject, Injector, toDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { BehaviorSubject } from 'rxjs';
import { StatusBarContainer } from '../../views/components/status-bar/StatusBarContainer';
import { BuiltInUIPart, IUIPartsService } from '../parts/parts.service';

export interface IStatusBarItem {
  readonly id: string;
  readonly text: string;
  readonly alignment?: 'left' | 'right';
  readonly priority?: number;
  readonly command?: string;
  readonly tooltip?: string;
  readonly icon?: string;
  readonly color?: string;
}

export interface IStatusBarService {
  readonly items$: Observable<ReadonlyArray<IStatusBarItem>>;
  readonly items: ReadonlyArray<IStatusBarItem>;

  registerItem(item: IStatusBarItem): IDisposable;
  updateItem(id: string, patch: Partial<IStatusBarItem>): void;
}

export const IStatusBarService = createIdentifier<IStatusBarService>('ui.status-bar-service');

export class StatusBarService extends Disposable implements IStatusBarService {
  private readonly _items$ = new BehaviorSubject<ReadonlyArray<IStatusBarItem>>([]);
  readonly items$: Observable<ReadonlyArray<IStatusBarItem>> = this._items$.asObservable();
  get items(): ReadonlyArray<IStatusBarItem> {
    return this._items$.getValue();
  }

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService
  ) {
    super();

    this.disposeWithMe(
      this._uiPartsService.registerComponent(
        BuiltInUIPart.FOOTER,
        () => connectInjector(StatusBarContainer, this._injector)
      )
    );
  }

  registerItem(item: IStatusBarItem): IDisposable {
    const next = this._mergeSorted([...this._items$.getValue(), item]);
    this._items$.next(next);

    return toDisposable(() => {
      const current = this._items$.getValue();
      const filtered = current.filter((it) => it.id !== item.id);
      if (filtered.length !== current.length) {
        this._items$.next(filtered);
      }
    });
  }

  updateItem(id: string, patch: Partial<IStatusBarItem>): void {
    const current = this._items$.getValue();
    const idx = current.findIndex((it) => it.id === id);
    if (idx < 0) {
      return;
    }
    const next = [...current];
    next[idx] = { ...next[idx], ...patch, id };
    this._items$.next(this._mergeSorted(next));
  }

  override dispose(): void {
    super.dispose();
    this._items$.complete();
  }

  private _mergeSorted(items: ReadonlyArray<IStatusBarItem>): ReadonlyArray<IStatusBarItem> {
    return [...items].sort((a, b) => {
      const alignA = a.alignment === 'right' ? 1 : 0;
      const alignB = b.alignment === 'right' ? 1 : 0;
      if (alignA !== alignB) {
        return alignA - alignB;
      }
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }
}
