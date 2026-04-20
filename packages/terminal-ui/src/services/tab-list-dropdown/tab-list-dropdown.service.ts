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
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export interface ITabListDropdownService {
  readonly open$: Observable<boolean>;
  open(): void;
  close(): void;
  toggle(): void;
}

export const ITabListDropdownService = createIdentifier<ITabListDropdownService>('terminal-ui.tab-list-dropdown-service');

export class TabListDropdownService extends Disposable implements ITabListDropdownService {
  private readonly _open$ = new BehaviorSubject<boolean>(false);
  readonly open$ = this._open$.asObservable();

  override dispose(): void {
    super.dispose();
    this._open$.complete();
  }

  open(): void {
    this._open$.next(true);
  }

  close(): void {
    this._open$.next(false);
  }

  toggle(): void {
    this._open$.next(!this._open$.getValue());
  }
}
