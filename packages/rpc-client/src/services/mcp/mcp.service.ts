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

import type { IMcpInstalledServer, IMcpRegistryItem, IMcpRemoteTool, IMcpServer, IMcpServerChangeEvent, IMcpService, McpRegistryCategory } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { EMPTY } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

export class McpService extends Disposable implements IMcpService {
  // TODO: Initialize via tRPC subscription when server-side support is added
  readonly installedServers$: Observable<IMcpInstalledServer[]> = EMPTY;
  readonly remoteTools$: Observable<IMcpRemoteTool[]> = EMPTY;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  async initialize(): Promise<void> {

  }

  private get _client() {
    return this._rpcClientService.getClient().mcp;
  }

  async servers(): Promise<IMcpServer[]> {
    return this._client.servers.query();
  }

  async add(config: Omit<IMcpInstalledServer, 'id' | 'status' | 'toolCount' | 'resourceCount'>): Promise<string> {
    return this._client.add.mutate(config);
  }

  async remove(id: string): Promise<void> {
    await this._client.remove.mutate(id);
  }

  async update(id: string, updates: Partial<Pick<IMcpInstalledServer, 'name' | 'description' | 'config' | 'transport'>>): Promise<void> {
    await this._client.update.mutate({ id, ...updates });
  }

  async enabled(id: string, enabled: boolean): Promise<void> {
    await this._client.enabled.mutate({ id, enabled });
  }

  async connect(id: string): Promise<void> {
    await this._client.connect.mutate(id);
  }

  async disconnect(id: string): Promise<void> {
    await this._client.disconnect.mutate(id);
  }

  async reconnect(id: string): Promise<void> {
    await this._client.reconnect.mutate(id);
  }

  async getTools(id: string): Promise<IMcpRemoteTool[]> {
    return this._client.getTools.query(id);
  }

  async getBuiltinTools(): Promise<IMcpRemoteTool[]> {
    return this._client.getBuiltinTools.query();
  }

  async callTool(id: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this._client.callTool.query({ id, toolName, args });
  }

  async installFromRegistry(registryId: string): Promise<string> {
    return this._client.installFromRegistry.mutate(registryId);
  }

  onChanged$(): Observable<IMcpServerChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._client.onChanged$.subscribe(undefined, opts));
  }

  async getRegistryAll(): Promise<IMcpRegistryItem[]> {
    return this._client.getRegistryAll.query();
  }

  async searchRegistry(query: string): Promise<IMcpRegistryItem[]> {
    return this._client.searchRegistry.query(query);
  }

  async getRegistryByCategory(category: McpRegistryCategory): Promise<IMcpRegistryItem[]> {
    return this._client.getRegistryByCategory.query(category);
  }

  async getRegistryFeatured(): Promise<IMcpRegistryItem[]> {
    return this._client.getRegistryFeatured.query();
  }
}
