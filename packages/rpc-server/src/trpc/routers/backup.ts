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

import type { IBackupExportFileResult, IBackupImportFileResult } from '@termlnk/sync';
import type { Buffer } from 'node:buffer';
import * as fs from 'node:fs/promises';
import { ILogService, Quantity } from '@termlnk/core';
import { IBackupService } from '@termlnk/sync';
import { z } from 'zod';
import { IFileDialogService } from '../../services/file-transfer/file-dialog.service';
import { publicProcedure, router } from '../trpc';

const DEFAULT_EXPORT_FILENAME_PREFIX = 'termlnk-backup';

/**
 * 加密备份导出/导入路由（**仅主进程**）。
 *
 * 字节流不跨 IPC：用户在渲染端点击"导出"时，主进程
 * 1. 调 IFileDialogService.showSaveDialog 让用户选目标路径
 * 2. 调 IBackupService.exportEncryptedBackup 拿加密 payload
 * 3. fs.writeFile 落盘
 * 4. 把 summary（含路径、计数）回传渲染端
 *
 * 导入反向：dialog → fs.readFile → IBackupService.importEncryptedBackup → summary。
 *
 * 取消语义：用户在 dialog 取消 → 返回 null（区别于 throw "已取消"）；
 * 错误语义：fs / decrypt 失败 → throw（渲染端 toast 弹出错误）。
 */
export const backupRouter = router({
  exportToFile: publicProcedure
    .mutation(async ({ ctx }): Promise<IBackupExportFileResult | null> => {
      const backupService = ctx.injector.get(IBackupService);
      const fileDialogService = ctx.injector.get(IFileDialogService);
      const logService = ctx.injector.get(ILogService);

      const defaultFileName = `${DEFAULT_EXPORT_FILENAME_PREFIX}-${formatBackupTimestamp(Date.now())}.tmbak`;
      const filePath = await fileDialogService.showSaveDialog({
        defaultFileName,
        title: 'Export encrypted backup',
      });
      if (!filePath) {
        return null;
      }

      const { payload, summary } = await backupService.exportEncryptedBackup();
      try {
        await fs.writeFile(filePath, payload);
      } catch (err) {
        logService.error('[backupRouter] write export failed:', err);
        throw new Error(`Failed to write backup file: ${normalizeMessage(err)}`);
      }

      return {
        filePath,
        exportedAt: summary.exportedAt,
        counts: summary.counts,
      };
    }),

  importFromFile: publicProcedure
    .input(z.object({ mode: z.enum(['replace', 'merge']) }))
    .mutation(async ({ ctx, input }): Promise<IBackupImportFileResult | null> => {
      const backupService = ctx.injector.get(IBackupService);
      const fileDialogService = ctx.injector.get(IFileDialogService);
      const logService = ctx.injector.get(ILogService);

      const paths = await fileDialogService.showOpenDialog({
        title: 'Restore from encrypted backup',
      });
      const filePath = paths[0];
      if (!filePath) {
        return null;
      }

      let bytes: Buffer;
      try {
        bytes = await fs.readFile(filePath);
      } catch (err) {
        logService.error('[backupRouter] read backup failed:', err);
        throw new Error(`Failed to read backup file: ${normalizeMessage(err)}`);
      }

      const summary = await backupService.importEncryptedBackup(
        new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        input.mode
      );
      return {
        filePath,
        mode: summary.mode,
        exportedAt: summary.exportedAt,
        counts: summary.counts,
      };
    }),

  /**
   * 主密钥状态查询——渲染端在弹出"导出"按钮前用来禁用未解锁的入口。
   * IBackupService 用 Quantity.OPTIONAL 注入：未注册（云未配置）也走这条路返回 false。
   */
  isAvailable: publicProcedure.query(({ ctx }): boolean => {
    const service = ctx.injector.get(IBackupService, Quantity.OPTIONAL);
    return service !== null;
  }),
});

export type BackupRouter = typeof backupRouter;

/** YYYYMMDD-HHmmss 形式的时间戳，便于在文件名中区分多次备份。 */
function formatBackupTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function normalizeMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
