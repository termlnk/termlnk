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
import type { IKnownHost } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface IKnownHostDetailDialogState {
  open: boolean;
  host: Nullable<IKnownHost>;
}

export interface IKnownHostDetailDialogService {
  readonly state$: Observable<IKnownHostDetailDialogState>;
  readonly stateUpdate$: Observable<IKnownHostDetailDialogState>;
  getState(): IKnownHostDetailDialogState;
  open(host: IKnownHost): void;
  close(): void;
}
export const IKnownHostDetailDialogService = createIdentifier<IKnownHostDetailDialogService>('terminal-ui.known-host-detail-dialog-service');

const INITIAL_STATE: IKnownHostDetailDialogState = {
  open: false,
  host: null,
};

export class KnownHostDetailDialogService extends Disposable implements IKnownHostDetailDialogService {
  private readonly _state$ = new BehaviorSubject<IKnownHostDetailDialogState>(INITIAL_STATE);
  readonly state$: Observable<IKnownHostDetailDialogState> = this._state$.asObservable();

  private readonly _stateUpdate$ = new Subject<IKnownHostDetailDialogState>();
  readonly stateUpdate$: Observable<IKnownHostDetailDialogState> = this._stateUpdate$.asObservable();

  getState(): IKnownHostDetailDialogState {
    return this._state$.getValue();
  }

  open(host: IKnownHost): void {
    this._transition({ open: true, host });
  }

  close(): void {
    if (!this._state$.getValue().open) {
      return;
    }
    this._transition({ ...INITIAL_STATE });
  }

  override dispose(): void {
    super.dispose();
    this._state$.complete();
    this._stateUpdate$.complete();
  }

  private _transition(next: IKnownHostDetailDialogState): void {
    this._state$.next(next);
    this._stateUpdate$.next(next);
  }
}
