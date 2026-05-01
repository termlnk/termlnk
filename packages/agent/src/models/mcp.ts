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

import type { AgentToolCategory } from './tool';

export interface IMcpServer {
  id: string;
  registryId: string;
  name: string;
  description: string;
  transport: McpTransportType;
  config: McpServerConfig;
  capabilities: IMcpServerCapabilities;
  toolCount: number;
  resourceCount: number;
  enabled: boolean;
  status: McpConnectionStatus;
  lastError: string;
}

export type McpTransportType = 'stdio' | 'http';
export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type McpRemoteProtocol = 'streamable-http' | 'sse';

export type McpServerConfig =
  | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string>; cwd?: string }
  | { type: 'http'; url: string; protocol: McpRemoteProtocol; headers?: Record<string, string> };

export interface IMcpInstalledServer {
  id: string;
  registryId?: string;
  name: string;
  description?: string;
  transport: McpTransportType;
  config: McpServerConfig;
  enabled: boolean;
  status: McpConnectionStatus;
  toolCount: number;
  resourceCount: number;
  lastError?: string;
}

export interface IMcpServerCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
}

export interface IMcpRemoteTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
  serverName: string;
  /** Optional human-readable display label. Falls back to name if not set. */
  label?: string;
  /** Tool category for UI grouping. */
  category?: AgentToolCategory;
  /** Mirrored from MCP tool annotations.readOnlyHint. */
  readOnlyHint?: boolean;
}

export interface IMcpServerChangeEvent {
  type: 'add' | 'update' | 'delete';
  id: string;
}

export interface IMcpConfig {
  /**
   * Whether to enable the MCP server on startup.
   */
  enabled?: boolean;

  /**
   * Transport mode: 'stdio' for local subprocess, 'http' for Streamable HTTP.
   * @default 'http'
   */
  transport?: 'stdio' | 'http';

  /**
   * Server name exposed via MCP protocol.
   */
  serverName?: string;

  /**
   * Server version exposed via MCP protocol.
   */
  serverVersion?: string;

  /**
   * Port for HTTP transport.
   * @default 23580
   */
  port?: number;

  /**
   * Host for HTTP transport.
   * @default '0.0.0.0'
   */
  host?: string;
}

/**
 * Simplified MCP config for settings UI (without internal fields).
 */
export interface IMcpSettingsConfig {
  enabled: boolean;
  transport: McpTransportType;
  port: number;
  host: string;
}
