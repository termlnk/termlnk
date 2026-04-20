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

import type { Observable } from 'rxjs';
import type { IMcpInstalledServer, IMcpRemoteTool, IMcpServer, IMcpServerChangeEvent } from '../models/mcp';
import { createIdentifier } from '@termlnk/core';

export interface IMcpService {
  readonly installedServers$: Observable<IMcpInstalledServer[]>;
  readonly remoteTools$: Observable<IMcpRemoteTool[]>;

  initialize(): Promise<void>;
  servers(): Promise<IMcpServer[]>;
  add(config: Omit<IMcpInstalledServer, 'id' | 'status' | 'toolCount' | 'resourceCount'>): Promise<string>;
  remove(id: string): Promise<void>;
  update(id: string, updates: Partial<Pick<IMcpInstalledServer, 'name' | 'description' | 'config' | 'transport'>>): Promise<void>;
  enabled(id: string, enabled: boolean): Promise<void>;
  connect(id: string): Promise<void>;
  disconnect(id: string): Promise<void>;
  reconnect(id: string): Promise<void>;
  getTools(id: string): Promise<IMcpRemoteTool[]>;
  getBuiltinTools(): Promise<IMcpRemoteTool[]>;
  callTool(id: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
  installFromRegistry(registryId: string): Promise<string>;
  onChanged$(): Observable<IMcpServerChangeEvent>;
}

export const IMcpService = createIdentifier<IMcpService>('agent.mcp-service');
