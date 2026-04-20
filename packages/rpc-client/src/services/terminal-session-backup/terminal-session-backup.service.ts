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

import { createIdentifier, Disposable } from '@termlnk/core';
import { IRPCClientService } from '../rpc-client.service';

/**
 * Client-side facade for the terminal-session backup table.
 * Payload shape (`IPersistedTerminalStateV2`) is owned by `@termlnk/terminal-ui`;
 * this layer transports it as an opaque JSON blob.
 */
export interface ITerminalSessionBackupService {
  load<T = unknown>(): Promise<T | null>;
  save<T = unknown>(data: T): Promise<void>;
  clear(): Promise<void>;
}

export const ITerminalSessionBackupService = createIdentifier<ITerminalSessionBackupService>('rpc-client.terminal-session-backup-service');

export class TerminalSessionBackupService extends Disposable implements ITerminalSessionBackupService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().terminalSessionBackup;
  }

  async load<T = unknown>(): Promise<T | null> {
    return this._client.load.query() as Promise<T | null>;
  }

  async save<T = unknown>(data: T): Promise<void> {
    await this._client.save.mutate(data);
  }

  async clear(): Promise<void> {
    await this._client.clear.mutate();
  }
}
