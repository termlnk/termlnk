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

import type { Layout } from 'react-resizable-panels';
import type { Observable } from 'rxjs';
import { Disposable, isEqual } from '@termlnk/core';
import { BehaviorSubject, distinctUntilChanged, filter, map, Subject } from 'rxjs';

export interface IResizableLayout extends Layout {
  left: number;
  content: number;
  right: number;
}

export type SidePanelType = Exclude<keyof IResizableLayout, 'content'>;

export const DEFAULT_RESIZABLE_LAYOUT: IResizableLayout = {
  left: 0,
  content: 100,
  right: 0,
};

export const DEFAULT_RESIZABLE_MIN: Record<SidePanelType, number> = {
  left: 15,
  right: 15,
};

export const RESIZABLE_LAYOUT_KEY = 'ui:resizable';
export const RESIZABLE_SIDE_RESTORE_PREFIX = `${RESIZABLE_LAYOUT_KEY}-restore`;

export class ResizableService extends Disposable {
  private readonly _layout$ = new BehaviorSubject<IResizableLayout>(DEFAULT_RESIZABLE_LAYOUT);
  readonly layout$ = this._layout$.asObservable().pipe(distinctUntilChanged(isEqual));
  get layout(): IResizableLayout { return this._layout$.getValue(); }

  private readonly _manual$ = new Subject<Record<SidePanelType, boolean>>();
  readonly manual$ = this._manual$.asObservable();

  private readonly _collapsed$ = new Subject<Record<SidePanelType, boolean>>();
  readonly collapsed$ = this._collapsed$.asObservable();

  constructor() {
    super();

    this._init();
  }

  override dispose() {
    super.dispose();
    this._collapsed$.complete();
    this._layout$.complete();
    this._manual$.complete();
  }

  private _init() {
    const layout = this._getItem<IResizableLayout>(RESIZABLE_LAYOUT_KEY);
    if (layout) {
      this._layout$.next(layout);
    }

    this.disposeWithMe(
      this._layout$.subscribe((layout) => this._setItem(RESIZABLE_LAYOUT_KEY, layout))
    );
  }

  setLayout(layout: Layout | IResizableLayout): void {
    this._recordSidePanelWidth();
    this._layout$.next(layout as IResizableLayout);

    this._collapsed$.next({ left: this.isCollapsed('left'), right: this.isCollapsed('right') });
  }

  getCollapsed$(side: SidePanelType): Observable<boolean> {
    return this._collapsed$.pipe(
      filter((v) => typeof v[side] !== 'undefined'),
      map((v) => v[side])
    );
  }

  getExpand$(side: SidePanelType): Observable<boolean> {
    return this._collapsed$.pipe(
      filter((v) => typeof v[side] !== 'undefined'),
      map((v) => !v[side])
    );
  }

  isCollapsed(side: SidePanelType): boolean {
    return this.layout[side] === 0;
  }

  collapse(side: SidePanelType): void {
    this._manual$.next({ [side]: true });
  }

  expand(side: SidePanelType): void {
    this._manual$.next({ [side]: false });
  }

  toggle(side: SidePanelType): void {
    if (this.isCollapsed(side)) {
      this.expand(side);
    } else {
      this.collapse(side);
    }
  }

  getCollapseLayout(side: SidePanelType): Layout {
    if (this.isCollapsed(side)) {
      return this.layout;
    }
    const layout = this._layout$.getValue();
    const contentWidth = layout.content + layout[side];
    return { ...layout, content: contentWidth, [side]: 0 };
  }

  getExpandLayout(side: SidePanelType = 'left'): Layout {
    if (!this.isCollapsed(side)) {
      return this.layout;
    }
    const layout = this._layout$.getValue();
    let lastWidth = this._getItem<number>(`${RESIZABLE_SIDE_RESTORE_PREFIX}-${side}`);
    lastWidth = lastWidth || DEFAULT_RESIZABLE_MIN[side];
    const contentWidth = layout.content - lastWidth;
    return { ...layout, content: contentWidth, [side]: lastWidth };
  }

  private _recordSidePanelWidth() {
    const layout = this._layout$.getValue();

    if (layout.left > 0) {
      this._setItem(`${RESIZABLE_SIDE_RESTORE_PREFIX}-left`, layout.left);
    }
    if (layout.right > 0) {
      this._setItem(`${RESIZABLE_SIDE_RESTORE_PREFIX}-right`, layout.right);
    }
  }

  private _getItem<T>(key: string): T | undefined {
    const value = localStorage.getItem(key);
    if (typeof value === 'undefined' || value === null) {
      return;
    }
    return JSON.parse(value) as T;
  }

  private _setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
