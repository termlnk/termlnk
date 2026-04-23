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

import { LocaleService } from '@termlnk/core';
import { Tooltip, TooltipContent, TooltipTrigger, useDependency, useObservable, useUpdateBinder } from '@termlnk/design';
import { IUpdaterService, UpdateStatus } from '@termlnk/electron';
import { IDialogService } from '@termlnk/ui';
import { ArrowDownToLine } from 'lucide-react';
import { UPDATE_DIALOG_ID } from '../../controllers/updater.controller';
import { UPDATE_DIALOG_COMPONENT_NAME } from './UpdateDialog';

const VISIBLE_STATUSES = new Set([
  UpdateStatus.AVAILABLE,
  UpdateStatus.DOWNLOADING,
  UpdateStatus.DOWNLOADED,
]);

export function UpdateButton() {
  const updaterService = useDependency(IUpdaterService);
  const dialogService = useDependency(IDialogService);
  const localeService = useDependency(LocaleService);
  const status = useObservable(updaterService.status$, UpdateStatus.IDLE);
  useUpdateBinder(localeService.localeChanged$);

  if (!VISIBLE_STATUSES.has(status)) {
    return null;
  }

  const isDownloading = status === UpdateStatus.DOWNLOADING;

  const openDialog = () => {
    dialogService.open({
      id: UPDATE_DIALOG_ID,
      draggable: true,
      width: 480,
      className: 'tm:overflow-hidden',
      disableAutoFocus: true,
      title: { title: 'electron-renderer.updater.dialog-title' },
      children: { componentId: UPDATE_DIALOG_COMPONENT_NAME },
      onClose: () => dialogService.close(UPDATE_DIALOG_ID),
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            tm:grid tm:h-[2.8rem] tm:w-full tm:cursor-pointer tm:grid-cols-[2px_1fr_2px] tm:items-center
            tm:overflow-hidden tm:text-center
            tm:hover:text-white
          `}
          onClick={openDialog}
        >
          <span aria-hidden />
          <span
            className={`
              tm:flex tm:items-center tm:justify-center
              ${isDownloading ? 'tm:animate-bounce' : ''}
            `}
          >
            <ArrowDownToLine size="1.2rem" />
          </span>
          <span aria-hidden />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        {status === UpdateStatus.DOWNLOADED
          ? localeService.t('electron-renderer.updater.update-ready')
          : localeService.t('electron-renderer.updater.new-version-available')}
      </TooltipContent>
    </Tooltip>
  );
}
