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

import type { IMcpInstalledServer, IMcpRegistryItem, IMcpRegistryService, IMcpRemoteTool, McpRegistryCategory } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { IRPCClientService } from '../rpc-client.service';

export class McpRegistryService extends Disposable implements IMcpRegistryService {
  readonly installedServers$: Observable<IMcpInstalledServer[]>;
  readonly remoteTools$: Observable<IMcpRemoteTool[]>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().mcpRegistry;
  }

  async getAll(): Promise<IMcpRegistryItem[]> {
    return this._client.getAll.query();
  }

  async getById(id: string): Promise<IMcpRegistryItem | undefined> {
    return this._client.getById.query(id);
  }

  async search(query: string): Promise<IMcpRegistryItem[]> {
    return this._client.search.query(query);
  }

  async getByCategory(category: McpRegistryCategory): Promise<IMcpRegistryItem[]> {
    return this._client.getByCategory.query(category);
  }

  async getFeatured(): Promise<IMcpRegistryItem[]> {
    return this._client.getFeatured.query();
  }
}
