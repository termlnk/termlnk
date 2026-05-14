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
 * Encrypted backup export/import router (**main process only**).
 *
 * Bytes never cross IPC. When the user clicks "Export" in the renderer:
 * 1. `IFileDialogService.showSaveDialog` asks the user for a destination
 * 2. `IBackupService.exportEncryptedBackup` produces the encrypted payload
 * 3. `fs.writeFile` writes it to disk
 * 4. The summary (path + counts) goes back to the renderer
 *
 * Import is the reverse: dialog → `fs.readFile` →
 * `IBackupService.importEncryptedBackup` → summary.
 *
 * Cancellation: dialog cancel returns null (not a thrown "canceled" error).
 * Errors: fs / decrypt failures throw so the renderer can toast them.
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
   * Master-key availability — the renderer uses this to disable the
   * "Export" entry point when locked. `IBackupService` is injected with
   * `Quantity.OPTIONAL`, so cloud-not-configured also surfaces as `false`.
   */
  isAvailable: publicProcedure.query(({ ctx }): boolean => {
    const service = ctx.injector.get(IBackupService, Quantity.OPTIONAL);
    return service !== null;
  }),
});

export type BackupRouter = typeof backupRouter;

/** `YYYYMMDD-HHmmss` timestamp; lets filenames distinguish multiple backups. */
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
