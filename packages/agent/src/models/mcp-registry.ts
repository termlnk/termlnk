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

import type { McpServerConfig, McpTransportType } from './mcp';

export type McpRegistryCategory = string;

export type McpRegistryInstallSource = 'community';
export type McpRegistryInputKind = 'parameter';
export type McpRegistryStatus = 'active' | 'deprecated' | 'deleted';

export interface IMcpRegistryInstallInput {
  key: string;
  kind: McpRegistryInputKind;
  name: string;
  description?: string;
  required: boolean;
  secret: boolean;
  defaultValue?: string;
  placeholder?: string;
}

export interface IMcpRegistryInstallOption {
  id: string;
  label: string;
  description?: string;
  source: McpRegistryInstallSource;
  transport: McpTransportType;
  config: McpServerConfig;
  inputs: IMcpRegistryInstallInput[];
  prerequisites: string[];
}

export interface IMcpRegistryItem {
  id: string;
  registryId: string;
  serverName: string;
  version?: string;
  name: string;
  title?: string;
  description: string;
  author: string;
  homepage?: string;
  repositoryUrl?: string;
  icon?: string;
  category: McpRegistryCategory;
  tags: string[];
  verified: boolean;
  featured: boolean;
  downloads: number;
  transport: McpTransportType;
  defaultConfig: McpServerConfig;
  installOptions: IMcpRegistryInstallOption[];
  installInputs: IMcpRegistryInstallInput[];
  status: McpRegistryStatus;
  stars?: number;
  publishedAt?: string;
  updatedAt?: string;
}
