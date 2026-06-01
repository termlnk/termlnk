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
import type { IDisposable } from '../../common/di';
import { createIdentifier } from '../../common/di';

export const IConfirmService = createIdentifier<IConfirmService>('core.confirm-service');

export interface IConfirmService<T = unknown> {
  readonly confirmOptions$: Observable<T[]>;

  /**
   * Mount a confirm dialog. The returned disposable removes it.
   * For most cases prefer `confirm()` — it wraps `open` in a Promise.
   */
  open(params: T): IDisposable;

  /**
   * Show a confirm dialog and resolve to `true` when the user confirms,
   * `false` when cancelled / dismissed. Always disposes itself when settled.
   */
  confirm(params: T): Promise<boolean>;

  /** Hide a specific dialog by id without unmounting siblings. */
  close(id: string): void;
}
