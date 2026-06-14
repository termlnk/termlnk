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
import { IKnownHostDetailDialogService } from '../../services/known-hosts/known-host-detail-dialog.service';
import { KnownHostDetailDialog } from '../../views/known-hosts/KnownHostDetailDialog';
import { KNOWN_HOST_DETAIL_DIALOG_COMPONENT_NAME } from './component-names';

export const KNOWN_HOST_DETAIL_DIALOG_ID = 'terminal-ui.known-host-detail.dialog';

export class KnownHostDetailDialogController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @IKnownHostDetailDialogService private readonly _knownHostDetailDialogService: IKnownHostDetailDialogService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._componentManagerService.register(
        KNOWN_HOST_DETAIL_DIALOG_COMPONENT_NAME,
        connectInjector(KnownHostDetailDialog, this._injector)
      )
    );

    this.disposeWithMe(
      this._knownHostDetailDialogService.stateUpdate$.subscribe((state) => {
        if (state.open) {
          this._open();
        } else {
          this._close();
        }
      })
    );
  }

  private _open(): void {
    this._dialogService.open({
      id: KNOWN_HOST_DETAIL_DIALOG_ID,
      draggable: true,
      width: 544,
      title: { title: this._localeService.t('terminal-ui.knownHosts.detail.title') },
      children: { componentId: KNOWN_HOST_DETAIL_DIALOG_COMPONENT_NAME },
      disableAutoFocus: true,
      onClose: () => this._knownHostDetailDialogService.close(),
    });
  }

  private _close(): void {
    this._dialogService.close(KNOWN_HOST_DETAIL_DIALOG_ID);
  }
}
