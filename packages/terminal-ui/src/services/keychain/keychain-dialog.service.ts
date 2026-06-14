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

import type { IPublicIdentity, IPublicSshKey } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

export type KeyDialogMode = 'generate' | 'new' | 'edit';

export interface IKeychainDialogState {
  key?: { mode: KeyDialogMode; key?: IPublicSshKey };
  identity?: { identity?: IPublicIdentity };
}

export interface IKeychainDialogService {
  readonly state$: Observable<IKeychainDialogState>;
  readonly stateUpdate$: Observable<IKeychainDialogState>;
  getState(): IKeychainDialogState;
  openGenerateKey(): void;
  openNewKey(): void;
  openEditKey(key: IPublicSshKey): void;
  openNewIdentity(): void;
  openEditIdentity(identity: IPublicIdentity): void;
  close(): void;
}
export const IKeychainDialogService = createIdentifier<IKeychainDialogService>('terminal-ui.keychain-dialog-service');

export class KeychainDialogService extends Disposable implements IKeychainDialogService {
  private readonly _state$ = new BehaviorSubject<IKeychainDialogState>({});
  readonly state$: Observable<IKeychainDialogState> = this._state$.asObservable();

  private readonly _stateUpdate$ = new Subject<IKeychainDialogState>();
  readonly stateUpdate$: Observable<IKeychainDialogState> = this._stateUpdate$.asObservable();

  getState(): IKeychainDialogState {
    return this._state$.getValue();
  }

  openGenerateKey(): void {
    this._transition({ key: { mode: 'generate' } });
  }

  openNewKey(): void {
    this._transition({ key: { mode: 'new' } });
  }

  openEditKey(key: IPublicSshKey): void {
    this._transition({ key: { mode: 'edit', key } });
  }

  openNewIdentity(): void {
    this._transition({ identity: {} });
  }

  openEditIdentity(identity: IPublicIdentity): void {
    this._transition({ identity: { identity } });
  }

  close(): void {
    const current = this._state$.getValue();
    if (!current.key && !current.identity) {
      return;
    }
    this._transition({});
  }

  override dispose(): void {
    super.dispose();
    this._state$.complete();
    this._stateUpdate$.complete();
  }

  private _transition(next: IKeychainDialogState): void {
    this._state$.next(next);
    this._stateUpdate$.next(next);
  }
}
