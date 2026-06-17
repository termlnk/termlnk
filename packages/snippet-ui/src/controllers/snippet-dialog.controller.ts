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
import { ISnippetDialogService } from '../services/snippet-dialog.service';
import { SNIPPET_DIALOG_COMPONENT_NAME, SnippetDialog } from '../views/SnippetDialog';

export const SNIPPET_DIALOG_ID = 'snippet-ui.snippet.dialog';

export class SnippetDialogController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IDialogService private readonly _dialogService: IDialogService,
    @ISnippetDialogService private readonly _snippetDialogService: ISnippetDialogService
  ) {
    super();
    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._componentManagerService.register(
        SNIPPET_DIALOG_COMPONENT_NAME,
        connectInjector(SnippetDialog, this._injector)
      )
    );

    this.disposeWithMe(
      this._snippetDialogService.stateUpdate$.subscribe((state) => {
        if (state.open) {
          this._open(state.mode);
        } else {
          this._close();
        }
      })
    );
  }

  private _open(mode: 'create' | 'edit'): void {
    const titleKey = mode === 'edit' ? 'snippet-ui.editor.editTitle' : 'snippet-ui.editor.createTitle';
    this._dialogService.open({
      id: SNIPPET_DIALOG_ID,
      draggable: true,
      width: 480,
      title: { title: this._localeService.t(titleKey) },
      children: { componentId: SNIPPET_DIALOG_COMPONENT_NAME },
      disableAutoFocus: true,
      onClose: () => this._snippetDialogService.close(),
    });
  }

  private _close(): void {
    this._dialogService.close(SNIPPET_DIALOG_ID);
  }
}
