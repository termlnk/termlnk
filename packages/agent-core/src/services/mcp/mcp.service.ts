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

import type { IMcpInstalledServer, IMcpRemoteTool, IMcpServer, IMcpServerChangeEvent, IMcpService, McpConnectionStatus, McpServerConfig, McpTransportType } from '@termlnk/agent';
import type { IProxy } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import type { IProxyFetchHandle } from './proxy-fetch';
import { IAgentToolRegistryService, IMcpRegistryService } from '@termlnk/agent';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository, McpServerRepository } from '@termlnk/database';
import { NETWORK_PLUGIN_CONFIG_KEY } from '@termlnk/network';
import { BehaviorSubject } from 'rxjs';
import { McpConnection } from './mcp-connection';
import { createProxyEnvironment, createProxyFetch } from './proxy-fetch';

export class McpService extends Disposable implements IMcpService {
  private readonly _servers$ = new BehaviorSubject<IMcpInstalledServer[]>([]);
  private readonly _remoteTools$ = new BehaviorSubject<IMcpRemoteTool[]>([]);
  private readonly _connections = new Map<string, McpConnection>();
  private readonly _serverTools = new Map<string, IMcpRemoteTool[]>();
  /** Per-connection proxy dispatchers; closed alongside their connection. */
  private readonly _proxyHandles = new Map<string, IProxyFetchHandle>();

  readonly installedServers$ = this._servers$.asObservable();
  readonly remoteTools$ = this._remoteTools$.asObservable();

  constructor(
    @Inject(McpServerRepository) private readonly _mcpServerRepository: McpServerRepository,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @IMcpRegistryService private readonly _mcpRegistryService: IMcpRegistryService,
    @IAgentToolRegistryService private readonly _mcpToolRegistryService: IAgentToolRegistryService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this.disposeWithMe(this._mcpServerRepository.changed$.subscribe(() => {
      this._reloadServers();
    }));
  }

  async initialize(): Promise<void> {
    await this._reloadServers();

    // Auto-connect enabled servers
    const servers = this._servers$.getValue();
    for (const server of servers) {
      if (server.enabled) {
        this.connect(server.id).catch((err) => {
          this._logService.warn(`[McpClient] Auto-connect failed for ${server.name}: ${err}`);
        });
      }
    }
  }

  async servers(): Promise<IMcpServer[]> {
    const servers = await this._mcpServerRepository.getAll();
    return servers.map((server) => {
      return {
        id: server.id,
        registryId: server.registryId,
        name: server.name,
        description: server.description,
        transport: server.transport,
        config: server.config,
        capabilities: server.capabilities,
        toolCount: server.toolCount,
        resourceCount: server.resourceCount,
        enabled: server.enabled,
        status: server.status,
        lastError: server.lastError,
      } as IMcpServer;
    });
  }

  async add(config: Omit<IMcpInstalledServer, 'id' | 'status' | 'toolCount' | 'resourceCount'>): Promise<string> {
    const id = await this._mcpServerRepository.create({
      registryId: config.registryId,
      name: config.name,
      description: config.description,
      transport: config.transport,
      config: config.config,
      enabled: config.enabled,
    });
    return id;
  }

  async remove(id: string): Promise<void> {
    await this.disconnect(id);
    await this._mcpServerRepository.delete(id);
  }

  async update(id: string, updates: Partial<Pick<IMcpInstalledServer, 'name' | 'description' | 'config' | 'transport'>>): Promise<void> {
    await this._mcpServerRepository.update(id, updates);
  }

  async enabled(id: string, enabled: boolean): Promise<void> {
    await this._mcpServerRepository.updateEnabled(id, enabled);
    if (enabled) {
      await this.connect(id);
    } else {
      await this.disconnect(id);
    }
  }

  async connect(id: string): Promise<void> {
    const server = await this._mcpServerRepository.getById(id);
    if (!server) {
      throw new Error(`Server not found: ${id}`);
    }

    // Disconnect existing connection
    if (this._connections.has(id)) {
      await this.disconnect(id);
    }

    await this._updateStatus(id, 'connecting');

    try {
      const proxy = await this._getEnabledProxy();
      const proxyHandle = server.config.type === 'http' && proxy ? createProxyFetch(proxy) : null;
      if (proxyHandle) {
        this._closeProxyHandle(id);
        this._proxyHandles.set(id, proxyHandle);
      }
      const connection = new McpConnection(server.config, {
        fetch: proxyHandle?.fetch,
        env: server.config.type === 'stdio' && proxy ? createProxyEnvironment(proxy) : undefined,
      });
      this._connections.set(id, connection);

      await connection.connect();
      await this._updateStatus(id, 'connected');

      // Fetch tools
      const tools = await connection.listTools();
      const remoteTools: IMcpRemoteTool[] = tools.map((t) => ({
        id: `${id}:${t.name}`,
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema as Record<string, unknown>,
        serverId: id,
        serverName: server.name,
      }));

      this._serverTools.set(id, remoteTools);
      await this._mcpServerRepository.updateToolCount(id, remoteTools.length);
      this._rebuildToolsList();

      this._logService.log(`[McpClient] Connected to ${server.name}, ${remoteTools.length} tools available`);
    } catch (err) {
      const causeMsg = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
      const errorMsg = causeMsg ? `${String(err)} (${causeMsg})` : String(err);
      await this._updateStatus(id, 'error', errorMsg);
      this._connections.delete(id);
      this._closeProxyHandle(id);
      throw err;
    }
  }

  async disconnect(id: string): Promise<void> {
    const connection = this._connections.get(id);
    if (connection) {
      await connection.close();
      this._connections.delete(id);
    }
    this._closeProxyHandle(id);
    this._serverTools.delete(id);
    await this._updateStatus(id, 'disconnected');
    this._rebuildToolsList();
  }

  async reconnect(id: string): Promise<void> {
    await this.disconnect(id);
    await this.connect(id);
  }

  async getTools(id: string): Promise<IMcpRemoteTool[]> {
    return this._serverTools.get(id) ?? [];
  }

  async getBuiltinTools(): Promise<IMcpRemoteTool[]> {
    const tools = this._mcpToolRegistryService.getTools();
    return tools
      .filter((tool) => !tool.hidden)
      .map((tool) => ({
        id: `builtin_${tool.name}`,
        name: tool.name,
        label: tool.label,
        description: tool.description,
        inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
        serverId: '__builtin__',
        serverName: 'Termlnk',
        category: tool.category,
      }));
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const connection = this._connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not connected: ${serverId}`);
    }
    return connection.callTool(toolName, args);
  }

  async installFromRegistry(registryId: string): Promise<string> {
    const item = await this._mcpRegistryService.getById(registryId);
    if (!item) {
      throw new Error('Registry item not found');
    }
    if (item.installOptions.length !== 1 || item.installInputs.length > 0) {
      throw new Error('Registry item requires selecting an installation method and parameters');
    }

    return this.add({
      registryId: item.registryId,
      name: item.name,
      description: item.description,
      transport: item.transport,
      config: item.defaultConfig,
      enabled: true,
    });
  }

  onChanged$(): Observable<IMcpServerChangeEvent> {
    return this._mcpServerRepository.changed$;
  }

  private async _getEnabledProxy(): Promise<IProxy | undefined> {
    const proxy = await this._configRepository.getField<IProxy>(NETWORK_PLUGIN_CONFIG_KEY, 'proxy');
    if (!proxy?.enabled) {
      return undefined;
    }
    return proxy;
  }

  private async _reloadServers(): Promise<void> {
    const entities = await this._mcpServerRepository.getAll();
    const servers: IMcpInstalledServer[] = entities.map((e) => {
      // Normalize legacy transport types: 'sse' and 'streamable-http' → 'http'
      const transport = this._normalizeTransport(e.transport as string);
      const config = this._normalizeConfig(e.config);
      return {
        id: e.id,
        registryId: e.registryId ?? undefined,
        name: e.name,
        description: e.description ?? undefined,
        transport,
        config,
        enabled: e.enabled,
        status: e.status,
        toolCount: e.toolCount,
        resourceCount: e.resourceCount,
        lastError: e.lastError ?? undefined,
      };
    });
    this._servers$.next(servers);
  }

  private _normalizeTransport(transport: string): McpTransportType {
    if (transport === 'sse' || transport === 'streamable-http') {
      return 'http';
    }
    return transport as McpTransportType;
  }

  private _normalizeConfig(config: McpServerConfig): McpServerConfig {
    // Database may contain legacy configs with type 'sse' or 'streamable-http'
    const raw = config as Record<string, unknown>;
    const type = raw.type as string;

    if (type === 'stdio') {
      return config;
    }

    // Derive protocol: legacy type 'sse' maps to 'sse', otherwise preserve existing or default
    let protocol: 'sse' | 'streamable-http' = 'streamable-http';
    if (type === 'sse' || raw.protocol === 'sse') {
      protocol = 'sse';
    }

    return {
      type: 'http',
      url: raw.url as string,
      protocol,
      headers: raw.headers as Record<string, string> | undefined,
    };
  }

  private async _updateStatus(id: string, status: McpConnectionStatus, lastError?: string): Promise<void> {
    await this._mcpServerRepository.updateStatus(id, status, lastError);
    await this._reloadServers();
  }

  private _rebuildToolsList(): void {
    this._remoteTools$.next(
      [...this._serverTools.values()].flat()
    );
  }

  private _closeProxyHandle(id: string): void {
    const handle = this._proxyHandles.get(id);
    if (!handle) {
      return;
    }
    this._proxyHandles.delete(id);
    handle.close().catch((err) => {
      this._logService.warn(`[McpClient] Failed to close proxy dispatcher for ${id}: ${String(err)}`);
    });
  }

  override dispose(): void {
    this._servers$.complete();
    this._remoteTools$.complete();
    for (const [, conn] of this._connections) {
      conn.close().catch(() => {});
    }
    this._connections.clear();
    for (const id of [...this._proxyHandles.keys()]) {
      this._closeProxyHandle(id);
    }
    this._serverTools.clear();
    super.dispose();
  }
}
