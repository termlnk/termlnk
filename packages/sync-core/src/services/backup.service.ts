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

import type { BackupImportMode, IBackupExportSummary, IBackupImportSummary, IBackupService } from '@termlnk/sync';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { BackupRepository } from '@termlnk/database';
import { BACKUP_PAYLOAD_PREFIX, ISyncCryptoService } from '@termlnk/sync';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const PREFIX_BYTES = TEXT_ENCODER.encode(BACKUP_PAYLOAD_PREFIX);

/**
 * 加密备份编排器。
 *
 * 数据流（导出）：
 *   BackupRepository.exportSnapshot()  → 明文凭据 IBackupSnapshot
 *   → JSON.stringify → utf8 bytes
 *   → SyncCryptoService.encrypt        → tmsync1: frame
 *   → 拼接 BACKUP_PAYLOAD_PREFIX        → tmbak1: 字节流（写文件）
 *
 * 数据流（导入）：
 *   tmbak1: bytes
 *   → 校验 + 剥离 BACKUP_PAYLOAD_PREFIX
 *   → SyncCryptoService.decrypt        → utf8 bytes
 *   → JSON.parse                       → IBackupSnapshot
 *   → BackupRepository.importSnapshot  → DB 写回（重新本地加密）
 *
 * 调用前提：master key 已 unlocked（SyncCryptoService.available === true）。
 * locked 时直接抛错——避免误导用户得到一个"成功"但实际什么也没做的状态。
 */
export class BackupService extends Disposable implements IBackupService {
  constructor(
    @Inject(BackupRepository) private readonly _backupRepo: BackupRepository,
    @Inject(ISyncCryptoService) private readonly _crypto: ISyncCryptoService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  async exportEncryptedBackup(): Promise<{ payload: Uint8Array; summary: IBackupExportSummary }> {
    if (!this._crypto.available) {
      throw new Error('[BackupService] master key is locked; cannot export backup');
    }

    const snapshot = await this._backupRepo.exportSnapshot();
    const json = JSON.stringify(snapshot);
    const sealed = this._crypto.encrypt(TEXT_ENCODER.encode(json));

    const payload = new Uint8Array(PREFIX_BYTES.length + sealed.length);
    payload.set(PREFIX_BYTES, 0);
    payload.set(sealed, PREFIX_BYTES.length);

    const summary: IBackupExportSummary = {
      exportedAt: snapshot.exportedAt,
      counts: this._countResources(snapshot.resources),
    };
    this._logService.log(`[BackupService] exported snapshot — ${describeCounts(summary.counts)}`);

    return { payload, summary };
  }

  async importEncryptedBackup(payload: Uint8Array, mode: BackupImportMode): Promise<IBackupImportSummary> {
    if (!this._crypto.available) {
      throw new Error('[BackupService] master key is locked; cannot import backup');
    }

    if (payload.length < PREFIX_BYTES.length || !startsWithBytes(payload, PREFIX_BYTES)) {
      throw new Error('[BackupService] payload missing tmbak1: prefix; not a termlnk backup file');
    }

    const inner = payload.subarray(PREFIX_BYTES.length);
    const decryptedBytes = this._crypto.decrypt(inner);
    let snapshot: import('@termlnk/database').IBackupSnapshot;
    try {
      snapshot = JSON.parse(TEXT_DECODER.decode(decryptedBytes));
    } catch (err) {
      throw new Error(`[BackupService] decrypted payload is not valid JSON: ${(err as Error).message}`);
    }

    await this._backupRepo.importSnapshot(snapshot, mode);

    const summary: IBackupImportSummary = {
      mode,
      exportedAt: snapshot.exportedAt,
      counts: this._countResources(snapshot.resources),
    };
    this._logService.log(`[BackupService] imported snapshot (${mode}) — ${describeCounts(summary.counts)}`);

    return summary;
  }

  private _countResources(resources: import('@termlnk/database').IBackupSnapshot['resources']): Record<string, number> {
    return {
      host: resources.host.length,
      config: resources.config.length,
      ai_provider: resources.ai_provider.length,
      ai_provider_model: resources.ai_provider_model.length,
      ai_custom_model: resources.ai_custom_model.length,
      mcp_server: resources.mcp_server.length,
      skill: resources.skill.length,
    };
  }
}

function startsWithBytes(buf: Uint8Array, prefix: Uint8Array): boolean {
  if (buf.length < prefix.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (buf[i] !== prefix[i]) {
      return false;
    }
  }
  return true;
}

function describeCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}
