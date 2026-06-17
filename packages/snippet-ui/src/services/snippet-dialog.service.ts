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

import type { Nullable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

export type SnippetDialogMode = 'create' | 'edit';

export interface ISnippetDialogState {
  open: boolean;
  mode: SnippetDialogMode;
  snippetId: Nullable<string>;
}

export interface ISnippetDialogService {
  readonly state$: Observable<ISnippetDialogState>;
  readonly stateUpdate$: Observable<ISnippetDialogState>;
  getState(): ISnippetDialogState;
  openCreate(): void;
  openEdit(snippetId: string): void;
  close(): void;
}
export const ISnippetDialogService = createIdentifier<ISnippetDialogService>('snippet-ui.snippet-dialog-service');

const INITIAL_STATE: ISnippetDialogState = {
  open: false,
  mode: 'create',
  snippetId: null,
};

export class SnippetDialogService extends Disposable implements ISnippetDialogService {
  private readonly _state$ = new BehaviorSubject<ISnippetDialogState>(INITIAL_STATE);
  readonly state$: Observable<ISnippetDialogState> = this._state$.asObservable();

  private readonly _stateUpdate$ = new Subject<ISnippetDialogState>();
  readonly stateUpdate$: Observable<ISnippetDialogState> = this._stateUpdate$.asObservable();

  override dispose(): void {
    super.dispose();
    this._state$.complete();
    this._stateUpdate$.complete();
  }

  getState(): ISnippetDialogState {
    return this._state$.getValue();
  }

  openCreate(): void {
    this._transition({ open: true, mode: 'create', snippetId: null });
  }

  openEdit(snippetId: string): void {
    this._transition({ open: true, mode: 'edit', snippetId });
  }

  close(): void {
    if (!this._state$.getValue().open) {
      return;
    }
    this._transition({ ...INITIAL_STATE });
  }

  private _transition(next: ISnippetDialogState): void {
    this._state$.next(next);
    this._stateUpdate$.next(next);
  }
}
