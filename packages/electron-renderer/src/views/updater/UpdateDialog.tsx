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

import type { IUpdateError, IUpdateInfo, IUpdateProgress } from '@termlnk/electron';
import { LocaleService } from '@termlnk/core';
import { Button, useDependency, useObservable } from '@termlnk/design';
import { IUpdaterService, UpdateStatus } from '@termlnk/electron';
import { useCallback, useEffect, useState } from 'react';

export const UPDATE_DIALOG_COMPONENT_NAME = 'electron-renderer.update-dialog';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function UpdateDialog() {
  const updaterService = useDependency(IUpdaterService);
  const localeService = useDependency(LocaleService);
  const status = useObservable(updaterService.status$, UpdateStatus.IDLE);
  const progress = useObservable<IUpdateProgress | undefined>(updaterService.progress$, undefined);
  const updateInfo = useObservable<IUpdateInfo | undefined>(updaterService.updateInfo$, undefined);
  const error = useObservable<IUpdateError | undefined>(updaterService.error$, undefined);

  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    updaterService.getCurrentVersion().then(setCurrentVersion);
  }, []);

  const handleDownload = useCallback(() => {
    updaterService.downloadUpdate();
  }, [updaterService]);

  const handleInstall = useCallback(() => {
    updaterService.quitAndInstall();
  }, [updaterService]);

  const handleRetry = useCallback(() => {
    updaterService.checkForUpdates();
  }, [updaterService]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4 tm:p-4">
      <p className="tm:text-sm tm:text-grey-fg">
        {localeService.t('electron-renderer.updater.new-version-available')}
      </p>

      {/* Version comparison */}
      {updateInfo && (
        <div className="tm:flex tm:items-center tm:justify-center tm:gap-4 tm:py-2">
          <div className="tm:text-center">
            <div className="tm:text-xs tm:text-grey">{localeService.t('electron-renderer.updater.current-version')}</div>
            <div className="tm:mt-1 tm:text-lg tm:font-semibold tm:text-light-grey">
              v
              {currentVersion}
            </div>
          </div>
          <span className="tm:text-grey-fg">&rarr;</span>
          <div className="tm:text-center">
            <div className="tm:text-xs tm:text-grey">{localeService.t('electron-renderer.updater.new-version')}</div>
            <div className="tm:mt-1 tm:text-lg tm:font-semibold tm:text-green">
              v
              {updateInfo.version}
            </div>
          </div>
        </div>
      )}

      {/* Release notes */}
      {updateInfo?.releaseNotes && (
        <div className="tm:flex tm:flex-col tm:gap-1">
          <div className="tm:text-xs tm:font-medium tm:text-grey-fg">{localeService.t('electron-renderer.updater.release-notes')}</div>
          <div
            className={`
              tm:max-h-[160px] tm:overflow-y-auto tm:rounded-sm tm:border tm:border-line tm:bg-darker-black tm:p-3
              tm:text-xs/relaxed tm:text-light-grey
            `}
          >
            <pre className="tm:font-sans tm:whitespace-pre-wrap">{updateInfo.releaseNotes}</pre>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {status === UpdateStatus.DOWNLOADING && progress && (
        <div className="tm:flex tm:flex-col tm:gap-1.5">
          <div className="tm:h-2 tm:w-full tm:overflow-hidden tm:rounded-full tm:bg-one-bg2">
            <div
              className="tm:h-full tm:rounded-full tm:bg-blue tm:transition-all tm:duration-300"
              style={{ width: `${Math.min(progress.percent, 100)}%` }}
            />
          </div>
          <div className="tm:flex tm:justify-between tm:text-xs tm:text-grey-fg">
            <span>
              {formatBytes(progress.transferred)}
              {' '}
              /
              {' '}
              {formatBytes(progress.total)}
            </span>
            <span>{formatSpeed(progress.bytesPerSecond)}</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {status === UpdateStatus.ERROR && error && (
        <div className="tm:rounded-sm tm:border tm:border-red/30 tm:bg-red/10 tm:p-3 tm:text-xs tm:text-red">
          {error.message}
        </div>
      )}

      {/* Actions */}
      <div className="tm:flex tm:justify-end tm:gap-2 tm:pt-1">
        {status === UpdateStatus.AVAILABLE && (
          <Button variant="default" size="sm" onClick={handleDownload}>
            {localeService.t('electron-renderer.updater.download-update')}
          </Button>
        )}
        {status === UpdateStatus.DOWNLOADING && (
          <Button variant="secondary" size="sm" disabled>
            {localeService.t('electron-renderer.updater.downloading')}
            {' '}
            {progress ? `${progress.percent.toFixed(0)}%` : ''}
          </Button>
        )}
        {status === UpdateStatus.DOWNLOADED && (
          <Button variant="default" size="sm" onClick={handleInstall}>
            {localeService.t('electron-renderer.updater.install-now')}
          </Button>
        )}
        {status === UpdateStatus.ERROR && (
          <Button variant="default" size="sm" onClick={handleRetry}>
            {localeService.t('electron-renderer.updater.retry')}
          </Button>
        )}
      </div>
    </div>
  );
}
