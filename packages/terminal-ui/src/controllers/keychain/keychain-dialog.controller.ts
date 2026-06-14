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

import { Inject, Injector, LocaleService, RxDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { ComponentManagerService, IDialogService } from '@termlnk/ui';
import { IKeychainDialogService } from '../../services/keychain/keychain-dialog.service';
import { IdentityDialog } from '../../views/keychain/IdentityDialog';
import { KeyDialog } from '../../views/keychain/KeyDialog';
import { IDENTITY_DIALOG_COMPONENT_NAME, KEY_DIALOG_COMPONENT_NAME } from './component-names';

export const KEY_DIALOG_ID = 'terminal-ui.key.dialog';
export const IDENTITY_DIALOG_ID = 'terminal-ui.identity.dialog';

export class KeychainDialogController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IKeychainDialogService private readonly _keychainDialogService: IKeychainDialogService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._componentManagerService.register(
        KEY_DIALOG_COMPONENT_NAME,
        connectInjector(KeyDialog, this._injector)
      )
    );
    this.disposeWithMe(
      this._componentManagerService.register(
        IDENTITY_DIALOG_COMPONENT_NAME,
        connectInjector(IdentityDialog, this._injector)
      )
    );

    this.disposeWithMe(
      this._keychainDialogService.stateUpdate$.subscribe((state) => {
        if (state.key) {
          this._closeIdentity();
          this._openKey(state.key.mode);
        } else if (state.identity) {
          this._closeKey();
          this._openIdentity(state.identity.identity != null);
        } else {
          this._closeKey();
          this._closeIdentity();
        }
      })
    );
  }

  private _openKey(mode: string): void {
    const titleKey = mode === 'generate'
      ? 'terminal-ui.keychain.key.generateTitle'
      : mode === 'new'
        ? 'terminal-ui.keychain.key.newKeyTitle'
        : 'terminal-ui.keychain.key.editTitle';

    this._dialogService.open({
      id: KEY_DIALOG_ID,
      draggable: true,
      width: 544,
      title: { title: this._localeService.t(titleKey) },
      children: { componentId: KEY_DIALOG_COMPONENT_NAME },
      disableAutoFocus: true,
      onClose: () => this._keychainDialogService.close(),
    });
  }

  private _openIdentity(isEdit: boolean): void {
    this._dialogService.open({
      id: IDENTITY_DIALOG_ID,
      draggable: true,
      width: 512,
      title: {
        title: this._localeService.t(
          isEdit
            ? 'terminal-ui.keychain.identity.editTitle'
            : 'terminal-ui.keychain.identity.newTitle'
        ),
      },
      children: { componentId: IDENTITY_DIALOG_COMPONENT_NAME },
      disableAutoFocus: true,
      onClose: () => this._keychainDialogService.close(),
    });
  }

  private _closeKey(): void {
    this._dialogService.close(KEY_DIALOG_ID);
  }

  private _closeIdentity(): void {
    this._dialogService.close(IDENTITY_DIALOG_ID);
  }
}
