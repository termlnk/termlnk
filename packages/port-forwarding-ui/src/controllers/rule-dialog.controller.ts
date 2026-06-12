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
import { IRuleDialogService } from '../services/rule-dialog/rule-dialog.service';
import { RULE_DIALOG_COMPONENT_NAME, RuleDialog } from '../views/RuleDialog';

export const RULE_DIALOG_ID = 'port-forwarding-ui.rule.dialog';

export class RuleDialogController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IRuleDialogService private readonly _ruleDialogService: IRuleDialogService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._componentManagerService.register(
        RULE_DIALOG_COMPONENT_NAME,
        connectInjector(RuleDialog, this._injector)
      )
    );

    this.disposeWithMe(
      this._ruleDialogService.stateUpdate$.subscribe((state) => {
        if (state.open) {
          this._open();
        } else {
          this._close();
        }
      })
    );
  }

  // Title stays constant: the inner TypeSwitcher mutates the working type on
  // the fly, so a mode-driven title would lie about what the user is editing.
  private _open(): void {
    this._dialogService.open({
      id: RULE_DIALOG_ID,
      draggable: true,
      width: 544,
      title: { title: this._localeService.t('port-forwarding-ui.editor.title') },
      children: { componentId: RULE_DIALOG_COMPONENT_NAME },
      disableAutoFocus: true,
      onClose: () => this._ruleDialogService.close(),
    });
  }

  private _close(): void {
    this._dialogService.close(RULE_DIALOG_ID);
  }
}
