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

import type { IMcpRegistryInstallInput, IMcpRegistryInstallOption, IMcpRegistryItem, IMcpRegistryService, McpRegistryCategory, McpServerConfig } from '@termlnk/agent';
import type { IProxy } from '@termlnk/terminal';
import type { FetchLike } from './proxy-fetch';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { NETWORK_PLUGIN_CONFIG_KEY } from '@termlnk/network';
import { createProxyFetch } from './proxy-fetch';

const COMMUNITY_REGISTRY_URL = 'https://ravitemer.github.io/mcp-registry/registry.json';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;

interface ICommunityRegistryResponse {
  version?: string;
  generatedAt?: number;
  servers?: ICommunityRegistryServer[] | null;
}

interface ICommunityRegistryServer {
  id: string;
  name: string;
  description: string;
  author?: string;
  url?: string;
  category?: string;
  tags?: string[] | null;
  installations?: ICommunityRegistryInstallation[] | null;
  featured?: boolean;
  verified?: boolean;
  stars?: number;
  updatedAt?: number;
}

interface ICommunityRegistryInstallation {
  name: string;
  description?: string;
  config: string;
  prerequisites?: string[] | null;
  parameters?: ICommunityRegistryParameter[] | null;
  transports?: string[] | null;
}

interface ICommunityRegistryParameter {
  name: string;
  key?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
}

interface ICachedRegistryItems {
  items: IMcpRegistryItem[];
  fetchedAt: number;
}

type ICommunityConfig =
  | { command: string; args?: string[]; env?: Record<string, string>; cwd?: string }
  | { type: 'sse' | 'streamable-http' | 'http'; url: string; headers?: Record<string, string>; env?: Record<string, string> };

export class McpRegistryService extends Disposable implements IMcpRegistryService {
  private _cache: ICachedRegistryItems | null = null;
  private _pendingFetch: Promise<IMcpRegistryItem[]> | null = null;

  constructor(
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async getAll(): Promise<IMcpRegistryItem[]> {
    return this._getItems();
  }

  async search(query: string): Promise<IMcpRegistryItem[]> {
    const items = await this._getItems();
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => (
      item.name.toLowerCase().includes(normalizedQuery)
      || item.description.toLowerCase().includes(normalizedQuery)
      || item.serverName.toLowerCase().includes(normalizedQuery)
      || item.author.toLowerCase().includes(normalizedQuery)
      || item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      || item.category.toLowerCase().includes(normalizedQuery)
    ));
  }

  async getByCategory(category: McpRegistryCategory): Promise<IMcpRegistryItem[]> {
    const items = await this._getItems();
    return items.filter((item) => item.category === category);
  }

  async getById(id: string): Promise<IMcpRegistryItem | undefined> {
    const items = await this._getItems();
    return items.find((item) => item.id === id);
  }

  async getFeatured(): Promise<IMcpRegistryItem[]> {
    const items = await this._getItems();
    return items.filter((item) => item.featured);
  }

  private async _getItems(): Promise<IMcpRegistryItem[]> {
    if (this._cache && (Date.now() - this._cache.fetchedAt) < CACHE_TTL_MS) {
      return this._cache.items;
    }

    if (this._pendingFetch) {
      return this._pendingFetch;
    }

    this._pendingFetch = this._fetchItems();

    try {
      const items = await this._pendingFetch;
      this._cache = {
        items,
        fetchedAt: Date.now(),
      };
      return items;
    } catch (error) {
      if (this._cache) {
        this._logService.warn(`[MCPRegistry] Falling back to stale community registry cache: ${String(error)}`);
        return this._cache.items;
      }

      throw error;
    } finally {
      this._pendingFetch = null;
    }
  }

  private async _fetchItems(): Promise<IMcpRegistryItem[]> {
    const proxy = await this._getEnabledProxy();
    const proxyHandle = proxy ? createProxyFetch(proxy) : null;
    try {
      const fetcher: FetchLike = proxyHandle ? proxyHandle.fetch : fetch;
      const response = await fetcher(COMMUNITY_REGISTRY_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Termlnk-MCP-Marketplace',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Community MCP registry request failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json() as ICommunityRegistryResponse;
      const items = (payload.servers ?? [])
        .map((server) => this._mapServer(server, payload.generatedAt))
        .filter((item): item is IMcpRegistryItem => item !== null)
        .sort((left, right) => (
          Number(right.featured) - Number(left.featured)
          || Number(right.verified) - Number(left.verified)
          || (right.stars ?? 0) - (left.stars ?? 0)
          || left.name.localeCompare(right.name)
        ));

      this._logService.log(`[MCPRegistry] Loaded ${items.length} installable servers from the community registry`);
      return items;
    } finally {
      // Body is fully consumed above; release the dispatcher's sockets.
      if (proxyHandle) {
        proxyHandle.close().catch((err) => {
          this._logService.warn(`[MCPRegistry] Failed to close proxy dispatcher: ${String(err)}`);
        });
      }
    }
  }

  private _mapServer(server: ICommunityRegistryServer, generatedAt?: number): IMcpRegistryItem | null {
    const installOptions = (server.installations ?? [])
      .map((installation, index) => this._mapInstallation(server, installation, index))
      .filter((option): option is IMcpRegistryInstallOption => option !== null);

    if (installOptions.length === 0) {
      return null;
    }

    const primaryOption = installOptions[0];
    const tags = [...new Set([
      ...(server.tags ?? []),
      server.category ?? 'other',
      ...installOptions.map((option) => option.transport),
    ])];

    return {
      id: server.id,
      registryId: server.id,
      serverName: server.id,
      version: undefined,
      name: server.name,
      title: server.name,
      description: server.description,
      author: server.author?.trim() || this._deriveAuthor(server),
      homepage: server.url,
      repositoryUrl: server.url,
      icon: undefined,
      category: server.category?.trim() || 'other',
      tags,
      verified: server.verified ?? false,
      featured: server.featured ?? false,
      downloads: server.stars ?? 0,
      transport: primaryOption.transport,
      defaultConfig: primaryOption.config,
      installOptions,
      installInputs: primaryOption.inputs,
      status: 'active',
      stars: server.stars,
      publishedAt: this._toIsoString(generatedAt),
      updatedAt: this._toIsoString(server.updatedAt),
    };
  }

  private _mapInstallation(
    server: ICommunityRegistryServer,
    installation: ICommunityRegistryInstallation,
    index: number
  ): IMcpRegistryInstallOption | null {
    const parsedConfig = this._parseInstallationConfig(installation.config);
    if (!parsedConfig) {
      this._logService.warn(`[MCPRegistry] Skipping unsupported installation for ${server.id}: ${installation.name}`);
      return null;
    }

    const parameters = (installation.parameters ?? []).map((parameter) => this._createParameterInput(parameter));
    return {
      id: `${server.id}:${index}`,
      label: installation.name,
      description: installation.description,
      source: 'community',
      transport: parsedConfig.type,
      config: parsedConfig,
      inputs: parameters,
      prerequisites: installation.prerequisites ?? [],
    };
  }

  private _parseInstallationConfig(configSource: string): McpServerConfig | null {
    try {
      const parsed = JSON.parse(configSource) as ICommunityConfig;

      if ('command' in parsed && typeof parsed.command === 'string') {
        return {
          type: 'stdio',
          command: parsed.command,
          args: this._readStringArray(parsed.args),
          env: this._readStringRecord(parsed.env),
          cwd: typeof parsed.cwd === 'string' ? parsed.cwd : undefined,
        };
      }

      if ('url' in parsed && typeof parsed.url === 'string') {
        const env = this._readStringRecord(parsed.env);
        if (env && Object.keys(env).length > 0) {
          return null;
        }

        const protocol = parsed.type === 'sse' ? 'sse' : 'streamable-http';
        return {
          type: 'http',
          url: parsed.url,
          protocol,
          headers: this._readStringRecord(parsed.headers),
        };
      }
    } catch (error) {
      this._logService.warn(`[MCPRegistry] Failed to parse installation config: ${String(error)}`);
    }

    return null;
  }

  private _readStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const items = value.filter((entry): entry is string => typeof entry === 'string');
    return items.length > 0 ? items : undefined;
  }

  private _readStringRecord(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const entries = Object.entries(value)
      .filter(([, entryValue]) => typeof entryValue === 'string')
      .map(([key, entryValue]) => [key, entryValue as string] as const);

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  private _createParameterInput(parameter: ICommunityRegistryParameter): IMcpRegistryInstallInput {
    const key = parameter.key?.trim() || parameter.name.trim();

    return {
      key,
      kind: 'parameter',
      name: parameter.name,
      description: parameter.description,
      required: parameter.required ?? false,
      secret: /token|secret|key|password/i.test(key),
      defaultValue: undefined,
      placeholder: parameter.placeholder,
    };
  }

  private _deriveAuthor(server: ICommunityRegistryServer): string {
    if (server.url) {
      const match = server.url.match(/^https:\/\/github\.com\/([^/]+)\/[^/]+/i);
      if (match?.[1]) {
        return match[1];
      }
    }

    return server.id;
  }

  private _toIsoString(value?: number): string | undefined {
    if (!value || Number.isNaN(value)) {
      return undefined;
    }

    return new Date(value * 1000).toISOString();
  }

  private async _getEnabledProxy(): Promise<IProxy | undefined> {
    const proxy = await this._configRepository.getField<IProxy>(NETWORK_PLUGIN_CONFIG_KEY, 'proxy');
    if (!proxy?.enabled) {
      return undefined;
    }
    return proxy;
  }
}
