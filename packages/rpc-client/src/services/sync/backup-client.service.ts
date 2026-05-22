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
import { IRPCClientService } from '../rpc-client.service';

// Renderer-side facade: pure tRPC forwarding. The backup payload bytes never cross IPC —
// the main-process route uses the file dialog and fs APIs, returning only a summary
// (path, counts). Even a transient appearance of ciphertext in the renderer's IPC channel
// would be unnecessary exposure.
export class BackupClientService implements IBackupClientService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
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
