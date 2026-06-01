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

import { Disposable, Inject, LocaleService } from '@termlnk/core';
import { BuiltInUIPart, ComponentManagerService, IDialogService, IUIPartsService } from '@termlnk/ui';
import { distinctUntilChanged } from 'rxjs';
import { AccountDialogService } from '../services/account-dialog/account-dialog.service';
import { AccountButton } from '../views/AccountButton';
import { AccountDialogContent } from '../views/AccountDialogContent';

export const ACCOUNT_DIALOG_ID = 'auth-ui.account.dialog';
export const ACCOUNT_DIALOG_COMPONENT_NAME = 'auth-ui.account-dialog.content';

export class AccountDialogController extends Disposable {
  constructor(
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(AccountDialogService) private readonly _accountDialogService: AccountDialogService
  ) {
    super();
    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._componentManagerService.register(ACCOUNT_DIALOG_COMPONENT_NAME, AccountDialogContent)
    );

    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.SIDE_TAB_BAR, () => AccountButton)
    );

    this.disposeWithMe(
      this._accountDialogService.open$.pipe(distinctUntilChanged()).subscribe((open) => {
        if (open) {
          this._openDialog();
        } else {
          this._closeDialog();
        }
      })
    );
  }

  private _openDialog(): void {
    this._dialogService.open({
      id: ACCOUNT_DIALOG_ID,
      draggable: true,
      width: 480,
      title: { title: this._localeService.t('auth-ui.account-dialog.title') },
      children: { componentId: ACCOUNT_DIALOG_COMPONENT_NAME },
      // This is a presentational dialog; Radix's default "focus first tabbable
      // element" lands on the logout button, whose tooltip then opens on the
      // programmatic focus and stays pinned. Keep focus off the controls.
      disableAutoFocus: true,
      onClose: () => this._accountDialogService.close(),
    });
  }

  private _closeDialog(): void {
    this._dialogService.close(ACCOUNT_DIALOG_ID);
  }
}
