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

import type { McpServerConfig } from '@termlnk/agent';
import type { FetchLike } from './proxy-fetch';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Disposable } from '@termlnk/core';

const MCP_REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

export interface IMcpRemoteToolRaw {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface IMcpConnectionProxyOptions {
  fetch?: FetchLike;
  env?: Record<string, string>;
}

export class McpConnection extends Disposable {
  private _client: Client | null = null;
  private _transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | null = null;

  constructor(
    private readonly _config: McpServerConfig,
    private readonly _proxyOptions?: IMcpConnectionProxyOptions
  ) {
    super();
  }

  async connect(): Promise<void> {
    this._client = new Client({
      name: 'termlnk-mcp-client',
      version: '0.1.0',
    });

    this._transport = this._config.type === 'http'
      ? this._createRemoteTransport()
      : this._createStdioTransport();

    await this._client.connect(this._transport, { timeout: MCP_REQUEST_TIMEOUT_MS });
  }

  async listTools(): Promise<IMcpRemoteToolRaw[]> {
    if (!this._client) {
      throw new Error('Not connected');
    }

    const result = await this._client.listTools(undefined, { timeout: MCP_REQUEST_TIMEOUT_MS });
    return (result.tools ?? []) as IMcpRemoteToolRaw[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this._client) {
      throw new Error('Not connected');
    }

    return this._client.callTool({ name, arguments: args });
  }

  async close(): Promise<void> {
    if (this._client) {
      await this._client.close();
      this._client = null;
    }
    this._transport = null;
  }

  private _createStdioTransport(): StdioClientTransport {
    if (this._config.type !== 'stdio') {
      throw new Error(`Expected stdio transport, got: ${this._config.type}`);
    }

    return new StdioClientTransport({
      command: this._config.command,
      args: this._config.args,
      env: {
        ...this._proxyOptions?.env,
        ...(this._config.env as Record<string, string> | undefined),
      },
      cwd: this._config.cwd,
    });
  }

  private _createRemoteTransport(): StreamableHTTPClientTransport | SSEClientTransport {
    if (this._config.type !== 'http') {
      throw new Error(`Expected remote transport, got: ${this._config.type}`);
    }

    const url = new URL(this._config.url);
    const requestInit = this._config.headers ? { headers: this._config.headers } : undefined;

    if (this._config.protocol === 'sse') {
      return new SSEClientTransport(url, {
        fetch: this._proxyOptions?.fetch,
        requestInit,
      });
    }

    return new StreamableHTTPClientTransport(url, {
      fetch: this._proxyOptions?.fetch,
      requestInit,
    });
  }
}
