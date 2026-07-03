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

import type { IBackupFileService, IBackupExportFileResult, IBackupImportFileResult } from '@termlnk/sync';
import { AuthState, IAuthService } from '@termlnk/auth';
import { IConfirmService, ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { IBackupFileService as IBackupFileServiceId } from '@termlnk/sync';
import { CheckCircle2Icon, DownloadIcon, LockIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';

type BackupActionStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; action: 'export' | 'import' }
  | { kind: 'success-export'; result: IBackupExportFileResult }
  | { kind: 'success-import'; result: IBackupImportFileResult }
  | { kind: 'error'; message: string };

// Encrypted backup export/import card. Returns null when IBackupFileService is unbound;
// disables buttons until the user is authenticated (master key is required to seal/open
// the backup). Backup bytes never cross IPC — the renderer only sees a path + summary.
// Import currently uses `replace` mode; `merge` is gated on the LWW engine.
export function BackupCard() {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const backupClient = useDependency(IBackupFileServiceId, Quantity.OPTIONAL);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);

  const authState = useObservable<AuthState>(
    authClient?.authState$ ?? null,
    AuthState.Unauthenticated
  );

  const [status, setStatus] = useState<BackupActionStatus>({ kind: 'idle' });

  if (!backupClient) {
    return null;
  }

  const isUnlocked = authState === AuthState.Authenticated;
  const isBusy = status.kind === 'busy';
  const buttonsDisabled = !isUnlocked || isBusy;

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-3')}>
      {!isUnlocked && (
        <div
          className={cn(`
            tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-yellow/10 tm:px-3 tm:py-2 tm:text-xs tm:text-yellow
          `)}
        >
          <LockIcon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0')} />
          <span>{localeService.t('sync-ui.backup.locked-hint')}</span>
        </div>
      )}

      <div className={cn('tm:flex tm:items-center tm:gap-2')}>
        <Button
          variant="outline"
          size="sm"
          disabled={buttonsDisabled}
          onClick={() => {
            void runExport(backupClient, setStatus, logService);
          }}
          className={cn('tm:gap-1.5')}
        >
          <DownloadIcon className={cn('tm:size-3.5')} />
          {localeService.t('sync-ui.backup.export')}
        </Button>

        <ImportTrigger
          disabled={buttonsDisabled}
          backupClient={backupClient}
          setStatus={setStatus}
          logService={logService}
        />
      </div>

      <BackupStatusLine status={status} />
    </div>
  );
}

function BackupStatusLine({ status }: { status: BackupActionStatus }) {
  const localeService = useDependency(LocaleService);

  if (status.kind === 'idle') {
    return null;
  }
  if (status.kind === 'busy') {
    return (
      <div className={cn('tm:text-xs tm:text-grey-fg')}>
        {localeService.t(
          status.action === 'export'
            ? 'sync-ui.backup.exporting'
            : 'sync-ui.backup.importing'
        )}
      </div>
    );
  }
  if (status.kind === 'success-export') {
    return (
      <div
        className={cn(`
          tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-green/10 tm:px-3 tm:py-2 tm:text-xs tm:text-green
        `)}
      >
        <CheckCircle2Icon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0')} />
        <div className={cn('tm:flex tm:flex-col tm:gap-0.5')}>
          <span>{localeService.t('sync-ui.backup.export-success')}</span>
          <span className={cn('tm:break-all tm:text-grey-fg')}>{status.result.filePath}</span>
          <span className={cn('tm:text-grey-fg')}>{describeCounts(status.result.counts, localeService)}</span>
        </div>
      </div>
    );
  }
  if (status.kind === 'success-import') {
    return (
      <div
        className={cn(`
          tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-green/10 tm:px-3 tm:py-2 tm:text-xs tm:text-green
        `)}
      >
        <CheckCircle2Icon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0')} />
        <div className={cn('tm:flex tm:flex-col tm:gap-0.5')}>
          <span>{localeService.t('sync-ui.backup.import-success')}</span>
          <span className={cn('tm:break-all tm:text-grey-fg')}>{status.result.filePath}</span>
          <span className={cn('tm:text-grey-fg')}>{describeCounts(status.result.counts, localeService)}</span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn('tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-red/10 tm:px-3 tm:py-2 tm:text-xs tm:text-red')}
    >
      <TriangleAlertIcon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0')} />
      <span>{status.message}</span>
    </div>
  );
}

interface IImportTriggerProps {
  readonly disabled: boolean;
  readonly backupClient: IBackupFileService;
  readonly setStatus: (status: BackupActionStatus) => void;
  readonly logService: ILogService;
}

function ImportTrigger({ disabled, backupClient, setStatus, logService }: IImportTriggerProps) {
  const localeService = useDependency(LocaleService);
  const confirmService = useDependency(IConfirmService);

  const handleClick = async () => {
    const confirmed = await confirmService.confirm({
      id: 'sync-ui.backup.import-confirm',
      title: { title: localeService.t('sync-ui.backup.import-confirm-title') },
      description: { title: localeService.t('sync-ui.backup.import-confirm-description') },
      confirmText: localeService.t('sync-ui.backup.import-confirm-action'),
      cancelText: localeService.t('sync-ui.backup.cancel'),
      // Import replaces every host / setting / provider / mcp / skill row in the
      // local database — irreversible data loss, treat as destructive.
      confirmVariant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    await runImport(backupClient, setStatus, logService);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => { void handleClick(); }}
      className={cn('tm:gap-1.5')}
    >
      <UploadIcon className={cn('tm:size-3.5')} />
      {localeService.t('sync-ui.backup.import')}
    </Button>
  );
}

async function runExport(
  client: IBackupFileService,
  setStatus: (status: BackupActionStatus) => void,
  logService: ILogService
): Promise<void> {
  setStatus({ kind: 'busy', action: 'export' });
  try {
    const result = await client.exportToFile();
    if (!result) {
      setStatus({ kind: 'idle' });
      return;
    }
    setStatus({ kind: 'success-export', result });
  } catch (err) {
    logService.error('[BackupCard] export failed:', err);
    setStatus({ kind: 'error', message: normalizeMessage(err) });
  }
}

async function runImport(
  client: IBackupFileService,
  setStatus: (status: BackupActionStatus) => void,
  logService: ILogService
): Promise<void> {
  setStatus({ kind: 'busy', action: 'import' });
  try {
    const result = await client.importFromFile('replace');
    if (!result) {
      setStatus({ kind: 'idle' });
      return;
    }
    setStatus({ kind: 'success-import', result });
  } catch (err) {
    logService.error('[BackupCard] import failed:', err);
    setStatus({ kind: 'error', message: normalizeMessage(err) });
  }
}

function describeCounts(counts: Readonly<Record<string, number>>, localeService: LocaleService): string {
  const total = Object.values(counts).reduce((acc, n) => acc + n, 0);
  return localeService.t('sync-ui.backup.counts-summary', String(total));
}

function normalizeMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
