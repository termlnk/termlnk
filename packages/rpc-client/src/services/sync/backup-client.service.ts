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

import type { BackupImportMode, IBackupClientService, IBackupExportFileResult, IBackupImportFileResult } from '@termlnk/sync';
import { Inject } from '@termlnk/core';
import { IRPCClientService } from '../rpc-client.service';

/**
 * 渲染端 IBackupClientService 实现——纯 tRPC 转发。
 *
 * 备份字节永远不跨 IPC：主进程的 backup 路由用 IFileDialogService 选路径 +
 * fs 读写文件，渲染端只看到 summary（含路径、计数）。这是架构 §0 安全边界的必要属性——
 * 加密备份字节流即便短暂出现在渲染进程的 IPC channel 也是不必要的暴露。
 */
export class BackupClientService implements IBackupClientService {
  constructor(
    @Inject(IRPCClientService) private readonly _rpcClientService: IRPCClientService
  ) {}

  private get _client() {
    return this._rpcClientService.getClient().backup;
  }

  async exportToFile(): Promise<IBackupExportFileResult | null> {
    return await this._client.exportToFile.mutate();
  }

  async importFromFile(mode: BackupImportMode): Promise<IBackupImportFileResult | null> {
    return await this._client.importFromFile.mutate({ mode });
  }
}
