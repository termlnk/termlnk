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
import { Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export type FileAction = 'download' | 'downloadToBrowser' | 'rename' | 'permissions' | 'delete';

/** Actions bound to the right-clicked entry, supplied by the pane. */
export type IFileContextActions = Partial<Record<FileAction, () => void>>;

export interface IFileContextTarget {
  entry: { filename: string; isDirectory: boolean };
  actions: IFileContextActions;
}

/**
 * Holds the right-clicked file target so file-menu commands (DI layer) can act
 * on it without receiving params. The pane sets the target before triggering
 * the context menu; commands read it here. Mirrors IHostExplorerService.
 */
export class FileContextService extends Disposable {
  private readonly _target$ = new BehaviorSubject<IFileContextTarget | null>(null);
  readonly target$: Observable<IFileContextTarget | null> = this._target$.asObservable();

  get target(): IFileContextTarget | null {
    return this._target$.getValue();
  }

  setTarget(target: IFileContextTarget): void {
    this._target$.next(target);
  }

  clear(): void {
    this._target$.next(null);
  }

  override dispose(): void {
    super.dispose();
    this._target$.complete();
  }
}
