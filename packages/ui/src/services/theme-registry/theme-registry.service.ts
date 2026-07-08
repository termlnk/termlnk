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

import type { ITheme } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';
import { ALL_THEMES, THEME_MAP } from '@termlnk/themes';
import { BehaviorSubject } from 'rxjs';

/**
 * Unified theme lookup layer. Merges built-in Base46 themes (@termlnk/themes)
 * with themes contributed at runtime (typically by extensions via a bridge
 * controller in @termlnk/extension-ui). All theme resolution — settings picker,
 * theme-mode resolver, terminal xterm mapping — must go through this service,
 * never `THEME_MAP.get(...)` directly.
 *
 * Extension themes are ADDITIVE: when an extension deactivates, the stored
 * slot name (`darkThemeName`/`lightThemeName`) is kept so the preference
 * survives a reload. Resolvers must fall back gracefully when a stored theme
 * is temporarily unavailable.
 */
export interface IThemeRegistryService {
  readonly themes$: Observable<ReadonlyArray<ITheme>>;

  getAllThemes(): ReadonlyArray<ITheme>;
  resolveTheme(themeName: string): ITheme | null;

  addTheme(key: string, theme: ITheme): void;
  removeTheme(key: string): void;
}
export const IThemeRegistryService = createIdentifier<IThemeRegistryService>('ui.theme-registry-service');

export class ThemeRegistryService extends Disposable implements IThemeRegistryService {
  private readonly _extraByKey = new Map<string, ITheme>();
  private readonly _themes$: BehaviorSubject<ReadonlyArray<ITheme>>;
  readonly themes$: Observable<ReadonlyArray<ITheme>>;

  constructor() {
    super();

    this._themes$ = new BehaviorSubject<ReadonlyArray<ITheme>>(this._compose());
    this.themes$ = this._themes$.asObservable();

    this.disposeWithMe(toDisposable(() => {
      this._extraByKey.clear();
      this._themes$.complete();
    }));
  }

  getAllThemes(): ReadonlyArray<ITheme> {
    return this._themes$.getValue();
  }

  resolveTheme(themeName: string): ITheme | null {
    return THEME_MAP.get(themeName) ?? this._findExtraByName(themeName) ?? null;
  }

  addTheme(key: string, theme: ITheme): void {
    this._extraByKey.set(key, theme);
    this._themes$.next(this._compose());
  }

  removeTheme(key: string): void {
    if (this._extraByKey.delete(key)) {
      this._themes$.next(this._compose());
    }
  }

  private _compose(): ReadonlyArray<ITheme> {
    if (this._extraByKey.size === 0) {
      return ALL_THEMES;
    }
    return [...ALL_THEMES, ...this._extraByKey.values()];
  }

  private _findExtraByName(themeName: string): ITheme | null {
    for (const theme of this._extraByKey.values()) {
      if (theme.name === themeName) {
        return theme;
      }
    }
    return null;
  }
}
