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
import type { PortForwardingType } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

export type RuleDialogMode = 'create' | 'edit';

export interface IRuleDialogState {
  open: boolean;
  mode: RuleDialogMode;
  ruleId: Nullable<string>;
  initialType: Nullable<PortForwardingType>;
}

export interface IRuleDialogService {
  readonly state$: Observable<IRuleDialogState>;
  // Emits only on explicit transitions, never on subscription. Controllers
  // bridging this state to IDialogService must subscribe here to avoid acting
  // on the initial `open: false` value of state$.
  readonly stateUpdate$: Observable<IRuleDialogState>;
  getState(): IRuleDialogState;
  openCreate(initialType: PortForwardingType): void;
  openEdit(ruleId: string): void;
  close(): void;
}
export const IRuleDialogService = createIdentifier<IRuleDialogService>('port-forwarding-ui.rule-dialog-service');

const INITIAL_STATE: IRuleDialogState = {
  open: false,
  mode: 'create',
  ruleId: null,
  initialType: null,
};

export class RuleDialogService extends Disposable implements IRuleDialogService {
  private readonly _state$ = new BehaviorSubject<IRuleDialogState>(INITIAL_STATE);
  readonly state$: Observable<IRuleDialogState> = this._state$.asObservable();

  private readonly _stateUpdate$ = new Subject<IRuleDialogState>();
  readonly stateUpdate$: Observable<IRuleDialogState> = this._stateUpdate$.asObservable();

  override dispose(): void {
    super.dispose();
    this._state$.complete();
    this._stateUpdate$.complete();
  }

  getState(): IRuleDialogState {
    return this._state$.getValue();
  }

  openCreate(initialType: PortForwardingType): void {
    this._transition({ open: true, mode: 'create', ruleId: null, initialType });
  }

  openEdit(ruleId: string): void {
    this._transition({ open: true, mode: 'edit', ruleId, initialType: null });
  }

  close(): void {
    if (!this._state$.getValue().open) {
      return;
    }
    this._transition({ ...INITIAL_STATE });
  }

  private _transition(next: IRuleDialogState): void {
    this._state$.next(next);
    this._stateUpdate$.next(next);
  }
}
