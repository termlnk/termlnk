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
import type { ITheme, ThemeType } from './theme';
import { BehaviorSubject, map } from 'rxjs';
import { createIdentifier } from '../../common/di';
import { Disposable, toDisposable } from '../../common/lifecycle';

export interface IThemeService {
  readonly currentTheme$: Observable<ITheme | null>;
  currentTheme: ITheme | null;

  readonly themeType$: Observable<ThemeType>;
  themeType: ThemeType;

  setTheme(theme: ITheme | null): void;
}
export const IThemeService = createIdentifier<IThemeService>('core.theme-service');

export class ThemeService extends Disposable implements IThemeService {
  private readonly _currentTheme$ = new BehaviorSubject<ITheme | null>(null);
  readonly currentTheme$: Observable<ITheme | null> = this._currentTheme$.asObservable();
  get currentTheme(): ITheme | null { return this._currentTheme$.getValue(); }

  readonly themeType$: Observable<ThemeType>;
  get themeType(): ThemeType {
    return this._currentTheme$.getValue()?.type ?? 'dark';
  }

  constructor() {
    super();

    // Derived from currentTheme$
    this.themeType$ = this._currentTheme$.pipe(
      map((theme) => theme?.type ?? 'dark')
    );

    this.disposeWithMe(toDisposable(() => {
      this._currentTheme$.complete();
    }));
  }

  /**
   * Set the current theme.
   * @param theme - The theme to apply, or null to use the default.
   */
  setTheme(theme: ITheme | null): void {
    this._currentTheme$.next(theme);
  }
}
