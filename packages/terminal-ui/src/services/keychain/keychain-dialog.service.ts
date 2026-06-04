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
import { Disposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export type KeyDialogMode = 'generate' | 'new' | 'edit';

export interface IKeychainDialogState {
  key?: { mode: KeyDialogMode; key?: IPublicSshKey };
  identity?: { identity?: IPublicIdentity };
}

/**
 * Holds which keychain dialog is open so commands (DI layer) can open dialogs
 * that the KeychainExplorer view renders by subscribing to `state$`. Mirrors
 * HostDialogService: the view never owns this state, commands drive it.
 */
export class KeychainDialogService extends Disposable {
  private readonly _state$ = new BehaviorSubject<IKeychainDialogState>({});
  readonly state$: Observable<IKeychainDialogState> = this._state$.asObservable();

  get state(): IKeychainDialogState {
    return this._state$.getValue();
  }

  openGenerateKey(): void {
    this._state$.next({ key: { mode: 'generate' } });
  }

  openNewKey(): void {
    this._state$.next({ key: { mode: 'new' } });
  }

  openEditKey(key: IPublicSshKey): void {
    this._state$.next({ key: { mode: 'edit', key } });
  }

  openNewIdentity(): void {
    this._state$.next({ identity: {} });
  }

  openEditIdentity(identity: IPublicIdentity): void {
    this._state$.next({ identity: { identity } });
  }

  close(): void {
    this._state$.next({});
  }

  override dispose(): void {
    super.dispose();
    this._state$.complete();
  }
}
