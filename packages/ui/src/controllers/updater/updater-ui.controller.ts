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

import { Disposable, ILogService, Inject, Injector, INotificationService, IUpdaterService, LocaleService, UpdateStatus } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map, pairwise, startWith } from 'rxjs/operators';
import { ComponentManagerService } from '../../services/component/component-manager.service';
import { IDialogService } from '../../services/dialog/dialog.service';
import { BuiltInUIPart, IUIPartsService } from '../../services/parts/parts.service';
import { UpdateButton } from '../../views/updater/UpdateButton';
import { UpdateDialog } from '../../views/updater/UpdateDialog';
import { UPDATE_DIALOG_COMPONENT_NAME, UPDATE_DIALOG_ID } from '../../views/updater/updater-constants';

const UPDATER_GROUP_ID = 'system.updater';

export class UpdaterUIController extends Disposable {
  private _lastBellNotificationId: string | null = null;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @Inject(ComponentManagerService) private readonly _componentManagerService: ComponentManagerService,
    @IUIPartsService private readonly _uiPartsService: IUIPartsService,
    @IUpdaterService private readonly _updaterService: IUpdaterService,
    @INotificationService private readonly _notificationService: INotificationService,
    @IDialogService private readonly _dialogService: IDialogService,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._init();
  }

  private _init(): void {
    this.disposeWithMe(
      this._componentManagerService.register(UPDATE_DIALOG_COMPONENT_NAME, UpdateDialog)
    );

    // Order 10: update button sits above the account button in the side tab bar.
    this.disposeWithMe(
      this._uiPartsService.registerComponent(BuiltInUIPart.SIDE_TAB_BAR, () => connectInjector(UpdateButton, this._injector), 10)
    );

    this._wireBellNotifications();

    void this._updaterService.checkForUpdates().catch((err) => {
      // Web shells throw NOT_SUPPORTED on download/install, but checkForUpdates
      // should resolve cleanly. Log unexpected failures (network, rate limit)
      // without crashing — UI surfaces the error via status$ → UpdateDialog.
      this._logService.warn('[UpdaterUIController] initial checkForUpdates failed:', err);
    });
  }

  /**
   * Push meaningful updater transitions into the header notification center
   * (source: system). Clicking the item opens the same update dialog as the
   * side-tab button.
   */
  private _wireBellNotifications(): void {
    const openDialog = (): void => {
      this._dialogService.open({
        id: UPDATE_DIALOG_ID,
        draggable: true,
        width: 480,
        className: 'tm:overflow-hidden',
        disableAutoFocus: true,
        title: { title: 'ui.updater.dialog-title' },
        children: { componentId: UPDATE_DIALOG_COMPONENT_NAME },
        onClose: () => this._dialogService.close(UPDATE_DIALOG_ID),
      });
    };

    this.disposeWithMe(
      combineLatest([
        this._updaterService.status$.pipe(startWith(UpdateStatus.IDLE), distinctUntilChanged()),
        this._updaterService.updateInfo$,
      ]).pipe(
        pairwise(),
        map(([[prevStatus], [nextStatus, info]]) => ({ prevStatus, nextStatus, info })),
        filter(({ prevStatus, nextStatus }) => prevStatus !== nextStatus)
      ).subscribe(({ nextStatus, info }) => {
        if (nextStatus === UpdateStatus.AVAILABLE) {
          this._pushBell({
            title: this._localeService.t('ui.updater.new-version-available'),
            body: info?.version
              ? this._localeService.t('ui.notification-panel.updater.available-body', info.version)
              : this._localeService.t('ui.notification-panel.updater.available-body-generic'),
            type: 'info',
            priority: 'normal',
            openDialog,
          });
          return;
        }

        if (nextStatus === UpdateStatus.DOWNLOADED) {
          this._pushBell({
            title: this._localeService.t('ui.updater.update-ready'),
            body: this._localeService.t('ui.notification-panel.updater.ready-body'),
            type: 'success',
            priority: 'high',
            openDialog,
          });
          return;
        }

        if (nextStatus === UpdateStatus.ERROR) {
          this._pushBell({
            title: this._localeService.t('ui.notification-panel.updater.error-title'),
            body: this._localeService.t('ui.notification-panel.updater.error-body'),
            type: 'error',
            priority: 'high',
            openDialog,
          });
        }
      })
    );
  }

  private _pushBell(opts: {
    title: string;
    body: string;
    type: 'info' | 'success' | 'error';
    priority: 'normal' | 'high';
    openDialog: () => void;
  }): void {
    // Replace prior updater row so the panel doesn't accumulate status spam.
    if (this._lastBellNotificationId) {
      this._notificationService.remove(this._lastBellNotificationId);
      this._lastBellNotificationId = null;
    }

    const n = this._notificationService.notify({
      title: opts.title,
      body: opts.body,
      type: opts.type,
      source: 'system',
      groupId: UPDATER_GROUP_ID,
      priority: opts.priority,
      showDesktop: true,
      transient: false,
      metadata: { kind: 'updater' },
      action: {
        type: 'callback',
        callback: opts.openDialog,
      },
    });
    this._lastBellNotificationId = n.id;
  }
}
