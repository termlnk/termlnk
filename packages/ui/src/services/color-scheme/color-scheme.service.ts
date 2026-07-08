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
import { createIdentifier, Disposable, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export type OSColorScheme = 'dark' | 'light';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

export interface IColorSchemeService {
  readonly scheme$: Observable<OSColorScheme>;
  readonly scheme: OSColorScheme;
}
export const IColorSchemeService = createIdentifier<IColorSchemeService>('ui.color-scheme-service');

/**
 * Reads the OS color scheme via CSS media query. Falls back to 'dark' when
 * running in an environment without matchMedia (SSR, jsdom without polyfill).
 * Follows the same lazy-window pattern as themes/utils/css-generator.ts.
 */
export class WebColorSchemeService extends Disposable implements IColorSchemeService {
  private readonly _scheme$: BehaviorSubject<OSColorScheme>;
  readonly scheme$: Observable<OSColorScheme>;
  get scheme(): OSColorScheme { return this._scheme$.getValue(); }

  constructor() {
    super();

    const initial = readInitialScheme();
    this._scheme$ = new BehaviorSubject<OSColorScheme>(initial);
    this.scheme$ = this._scheme$.asObservable();

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia(MEDIA_QUERY);
      const handler = (event: MediaQueryListEvent): void => {
        this._scheme$.next(event.matches ? 'dark' : 'light');
      };
      media.addEventListener('change', handler);
      this.disposeWithMe(toDisposable(() => media.removeEventListener('change', handler)));
    }

    this.disposeWithMe(toDisposable(() => this._scheme$.complete()));
  }
}

function readInitialScheme(): OSColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}
