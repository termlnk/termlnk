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
import type { ComponentType } from 'react';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';
import { BehaviorSubject, map } from 'rxjs';

export const DEFAULT_PAGE_ID = 'terminal';

export interface IContentPage {
  id: string;
  component: ComponentType;
  fullPage: boolean;
}

export interface IContentRouterService {
  readonly activePage$: Observable<string>;
  readonly activePage: string;
  readonly isFullPage$: Observable<boolean>;
  registerPage(page: IContentPage): IDisposable;
  getPage(id: string): IContentPage | undefined;
  navigate(pageId: string): void;
  isFullPage(): boolean;
}
export const IContentRouterService = createIdentifier<IContentRouterService>('ui.content-router-service');

export class ContentRouterService extends Disposable implements IContentRouterService {
  private readonly _pages = new Map<string, IContentPage>();

  private readonly _activePage$ = new BehaviorSubject<string>(DEFAULT_PAGE_ID);
  readonly activePage$: Observable<string> = this._activePage$.asObservable();
  get activePage(): string { return this._activePage$.getValue(); }

  readonly isFullPage$: Observable<boolean> = this._activePage$.pipe(
    map((pageId) => {
      const page = this._pages.get(pageId);
      return !!page?.fullPage;
    })
  );

  registerPage(page: IContentPage): IDisposable {
    this._pages.set(page.id, page);
    return toDisposable(() => {
      this._pages.delete(page.id);
      if (this._activePage$.getValue() === page.id) {
        this._activePage$.next(DEFAULT_PAGE_ID);
      }
    });
  }

  getPage(id: string): IContentPage | undefined {
    return this._pages.get(id);
  }

  navigate(pageId: string): void {
    this._activePage$.next(pageId);
  }

  isFullPage(): boolean {
    const page = this._pages.get(this._activePage$.getValue());
    return !!page?.fullPage;
  }

  override dispose(): void {
    super.dispose();
    this._activePage$.complete();
  }
}
