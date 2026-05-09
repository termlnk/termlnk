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

import type { IBackupClientService, IBackupExportFileResult, IBackupImportFileResult } from '@termlnk/sync';
import { AuthState, IAuthClientService } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Button, cn, useDependency, useObservable } from '@termlnk/design';
import { IBackupClientService as IBackupClientServiceId } from '@termlnk/sync';
import { CheckCircle2Icon, DownloadIcon, LockIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';
import { useState } from 'react';

type BackupActionStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; action: 'export' | 'import' }
  | { kind: 'success-export'; result: IBackupExportFileResult }
  | { kind: 'success-import'; result: IBackupImportFileResult }
  | { kind: 'error'; message: string };

/**
 * 加密备份卡片——导出/导入按钮组。
 *
 * 优雅降级：
 * - IBackupClientService 未注册（rpc-client 未配置或测试 stub）→ 不渲染
 * - IAuthClientService.authState !== Authenticated → 按钮禁用 + 显示"先登录"占位
 *   （加密备份 frame 需要 master key，master key 仅在登录时派生 + 内存持有）
 *
 * 安全语义：
 * - 备份字节流不出主进程；本组件只发出 mutate 请求 + 接收 summary
 * - 导入采用 `replace` 模式——P2.5 LWW 引擎已落地的 `merge` 模式将在后续版本启用
 */
export function BackupCard() {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const backupClient = useDependency(IBackupClientServiceId, Quantity.OPTIONAL);
  const authClient = useDependency(IAuthClientService, Quantity.OPTIONAL);

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
    <div className={cn('tm:flex tm:flex-col tm:gap-3 tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:p-4')}>
      <div className={cn('tm:flex tm:flex-col tm:gap-1')}>
        <span className={cn('tm:text-sm tm:font-medium tm:text-light-grey')}>
          {localeService.t('sync-ui.backup.title')}
        </span>
        <span className={cn('tm:text-xs tm:text-grey-fg')}>
          {localeService.t('sync-ui.backup.description')}
        </span>
      </div>

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
  readonly backupClient: IBackupClientService;
  readonly setStatus: (status: BackupActionStatus) => void;
  readonly logService: ILogService;
}

function ImportTrigger({ disabled, backupClient, setStatus, logService }: IImportTriggerProps) {
  const localeService = useDependency(LocaleService);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className={cn('tm:gap-1.5')}>
          <UploadIcon className={cn('tm:size-3.5')} />
          {localeService.t('sync-ui.backup.import')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{localeService.t('sync-ui.backup.import-confirm-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {localeService.t('sync-ui.backup.import-confirm-description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{localeService.t('sync-ui.backup.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void runImport(backupClient, setStatus, logService);
            }}
          >
            {localeService.t('sync-ui.backup.import-confirm-action')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

async function runExport(
  client: IBackupClientService,
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
  client: IBackupClientService,
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
