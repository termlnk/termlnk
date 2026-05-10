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

import type { IUpdateError, IUpdateInfo, IUpdateProgress } from '@termlnk/core';
import { IUpdaterService, LocaleService, Quantity, UpdateStatus } from '@termlnk/core';
import { Button, useDependency, useObservable, useUpdateBinder } from '@termlnk/design';
import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { IHostEnvironmentService } from '../../services/host-environment/host-environment.service';
import { ReleaseNotesMarkdown } from './ReleaseNotesMarkdown';

export { UPDATE_DIALOG_COMPONENT_NAME } from './updater-constants';

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function UpdateDialog() {
  const updaterService = useDependency(IUpdaterService);
  const localeService = useDependency(LocaleService);
  // Optional binding: WebRendererPlugin registers `web`; desktop falls through
  // to `electron`. Web hosts can't download/install in-app, so the action area
  // shows release notes and a manual-update hint instead of the install button.
  const hostEnvironment = useDependency(IHostEnvironmentService, Quantity.OPTIONAL);
  const host = hostEnvironment?.host ?? 'electron';
  const supportsInAppInstall = host === 'electron';
  useUpdateBinder(localeService.localeChanged$);
  const status = useObservable(updaterService.status$, UpdateStatus.IDLE);
  const progress = useObservable<IUpdateProgress | undefined>(updaterService.progress$, undefined);
  const updateInfo = useObservable<IUpdateInfo | null>(updaterService.updateInfo$, null);
  const error = useObservable<IUpdateError | undefined>(updaterService.error$, undefined);

  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    void updaterService.getCurrentVersion().then(setCurrentVersion);
  }, [updaterService]);

  const handleDownload = useCallback(() => {
    void updaterService.downloadUpdate();
  }, [updaterService]);

  const handleInstall = useCallback(() => {
    void updaterService.quitAndInstall();
  }, [updaterService]);

  const handleRetry = useCallback(() => {
    void updaterService.checkForUpdates();
  }, [updaterService]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4 tm:p-4">
      {/* Version comparison */}
      {updateInfo && (
        <div className="tm:flex tm:items-center tm:gap-3 tm:py-1">
          <span className="tm:font-mono tm:text-base tm:tracking-wider tm:text-grey">
            {currentVersion}
          </span>
          <ArrowRight className="tm:size-4 tm:text-grey" />
          <span className="tm:font-mono tm:text-base tm:font-semibold tm:tracking-wider tm:text-light-grey">
            {updateInfo.version}
          </span>
        </div>
      )}

      {/* Release notes */}
      {updateInfo?.releaseNotes && (
        <div className="tm:flex tm:flex-col tm:gap-1">
          <div className="tm:text-xs tm:font-medium tm:text-white">{localeService.t('ui.updater.release-notes')}</div>
          <div
            className={`
              tm:max-h-[200px] tm:overflow-y-auto tm:rounded-sm tm:border tm:border-line tm:bg-darker-black tm:p-3
            `}
          >
            <ReleaseNotesMarkdown content={updateInfo.releaseNotes} />
          </div>
        </div>
      )}

      {/* Web-only manual-update hint when there's a new version available */}
      {!supportsInAppInstall && status === UpdateStatus.AVAILABLE && (
        <div className="tm:rounded-sm tm:border tm:border-line tm:bg-one-bg2/40 tm:p-3 tm:text-xs tm:text-grey-fg">
          {localeService.t('ui.updater.manual-update-hint')}
        </div>
      )}

      {/* Progress bar (electron-only — web shells never enter DOWNLOADING) */}
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
        {status === UpdateStatus.AVAILABLE && supportsInAppInstall && (
          <Button variant="primary" size="sm" onClick={handleDownload}>
            {localeService.t('ui.updater.download-update')}
          </Button>
        )}
        {status === UpdateStatus.DOWNLOADING && (
          <Button variant="secondary" size="sm" disabled>
            {localeService.t('ui.updater.downloading')}
            {' '}
            {progress ? `${progress.percent.toFixed(0)}%` : ''}
          </Button>
        )}
        {status === UpdateStatus.DOWNLOADED && (
          <Button variant="primary" size="sm" onClick={handleInstall}>
            {localeService.t('ui.updater.install-now')}
          </Button>
        )}
        {status === UpdateStatus.ERROR && (
          <Button variant="primary" size="sm" onClick={handleRetry}>
            {localeService.t('ui.updater.retry')}
          </Button>
        )}
      </div>
    </div>
  );
}
