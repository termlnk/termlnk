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

import { ICommandService, Inject, Injector, RxDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { BuiltInUIPart, ComponentManagerService, IContentRouterService, IUIPartsService } from '@termlnk/ui';
import { FolderSync } from 'lucide-react';
import { NavigateToSFTPCommand, SFTP_PAGE_ID } from '../commands/navigate-sftp.command';
import { SFTPHeaderButton } from '../views/SFTPHeaderButton';
import { SFTPPage } from '../views/SFTPPage';
import { SFTP_ICON_NAME } from './component-names';

export class SFTPUIController extends RxDisposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ICommandService private readonly _commandService: ICommandService,
    @IContentRouterService private readonly _contentRouterService: IContentRouterService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService
  ) {
    super();

    this._initComponents();
    this._initPages();
    this._initCommands();
  }

  private _initComponents(): void {
    this.disposeWithMe(this._componentManagerService.register(SFTP_ICON_NAME, FolderSync));
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.HEADER_ACTION, () => connectInjector(SFTPHeaderButton, this._injector))
    );
  }

  private _initPages(): void {
    this.disposeWithMe(
      this._contentRouterService.registerPage({
        id: SFTP_PAGE_ID,
        component: connectInjector(SFTPPage, this._injector),
        fullPage: false,
      })
    );
  }

  private _initCommands(): void {
    this.disposeWithMe(this._commandService.registerCommand(NavigateToSFTPCommand));
  }
}
