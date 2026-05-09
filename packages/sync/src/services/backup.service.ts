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

import { createIdentifier } from '@termlnk/core';

// File magic for encrypted backups; distinct from the sync push payload prefix `tmsync1:`.
export const BACKUP_PAYLOAD_PREFIX = 'tmbak1:';

// Bump on serialization-format change.
export const BACKUP_PAYLOAD_VERSION = 1;

export type BackupImportMode = 'replace' | 'merge';

export interface IBackupExportSummary {
  readonly exportedAt: number;
  // UI-only counts per resource; no business logic depends on them.
  readonly counts: Readonly<Record<string, number>>;
}

export interface IBackupImportSummary {
  readonly mode: BackupImportMode;
  // Read from the file, not the import time.
  readonly exportedAt: number;
  readonly counts: Readonly<Record<string, number>>;
}

// Encrypted backup export/import (main-process only). Used to migrate the syncable
// resources (host / config / ai / mcp / skill) between devices via a file.
//
// Layout: `[BACKUP_PAYLOAD_PREFIX (8B)] [tmsync1: encrypted frame]`. The inner `tmsync1:`
// is encrypted with the master-key-derived sync key; the outer `tmbak1:` lets forensics
// distinguish a backup file from a runtime sync payload at first glance.
//
// Precondition: master key unlocked. Both export and import throw otherwise.
export interface IBackupService {
  exportEncryptedBackup(): Promise<{ payload: Uint8Array; summary: IBackupExportSummary }>;

  // Default mode is `replace` — the typical "moved to a new machine" semantic. `merge`
  // requires field-level metadata reconciliation and is gated on full LWW landing.
  importEncryptedBackup(payload: Uint8Array, mode: BackupImportMode): Promise<IBackupImportSummary>;
}

export const IBackupService = createIdentifier<IBackupService>('sync.backup-service');

// Backup byte streams never cross IPC: the file dialog and disk I/O run in the main
// process. The renderer "Export" button calls IBackupClientService.exportToFile() — Uint8Array
// never goes upstream or downstream.
export interface IBackupExportFileResult {
  readonly filePath: string;
  readonly exportedAt: number;
  readonly counts: Readonly<Record<string, number>>;
}

export interface IBackupImportFileResult {
  readonly filePath: string;
  readonly mode: BackupImportMode;
  readonly exportedAt: number;
  readonly counts: Readonly<Record<string, number>>;
}

// Renderer-side facade: wraps the file dialog and disk I/O around IBackupService.
// Returns null when the user cancels the dialog; throws on selected-path failure.
export interface IBackupClientService {
  exportToFile(): Promise<IBackupExportFileResult | null>;
  importFromFile(mode: BackupImportMode): Promise<IBackupImportFileResult | null>;
}

export const IBackupClientService = createIdentifier<IBackupClientService>('sync.backup-client-service');
