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

import type { IAgentTool, IAgentToolRegistryService, IAgentToolResult } from '@termlnk/agent';
import type { IDisposable, Injector } from '@termlnk/core';
import { ILogService } from '@termlnk/core';
import { ISSHToolService } from '@termlnk/rpc';

export function registerHostTools(toolRegistry: IAgentToolRegistryService, injector: Injector): IDisposable[] {
  return [
    toolRegistry.registerTool(createListHostsTool(injector)),
  ];
}

function createListHostsTool(injector: Injector): IAgentTool {
  const sshToolService = injector.get(ISSHToolService);
  const logService = injector.get(ILogService);

  return {
    name: 'termlnk_host_list',
    label: 'Host List',
    category: 'host',
    description: 'List configured SSH hosts and groups. Returns host tree (or flat list when flat=true). Use parentId to scope to a group. Call before opening a session via termlnk_terminal_create_session with the resulting hostId.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'Parent group ID to list children of. Omit to list root-level hosts and groups.',
        },
        flat: {
          type: 'boolean',
          description: 'Return a flat list instead of a tree structure. Default: false.',
        },
      },
    },
    handler: async (args) => {
      try {
        const parentId = typeof args.parentId === 'string' ? args.parentId : undefined;
        const flat = args.flat === true;

        const hosts = await sshToolService.listHosts(parentId, flat);

        return jsonOk({ hosts, count: hosts.length });
      } catch (err) {
        logService.error('[HostTools]', 'list_hosts failed:', err);
        return jsonError(`Failed to list hosts: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function jsonOk(data: Record<string, unknown>): IAgentToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function jsonError(message: string): IAgentToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
    isError: true,
  };
}
