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
import type { IDisposable, ILogService } from '@termlnk/core';
import type { ISSHToolService } from '@termlnk/rpc';

export function registerHostTools(
  toolRegistry: IAgentToolRegistryService,
  sshToolService: ISSHToolService,
  logService: ILogService
): IDisposable[] {
  const disposables: IDisposable[] = [];

  disposables.push(
    toolRegistry.registerTool(createListHostsTool(sshToolService, logService))
  );

  disposables.push(
    toolRegistry.registerTool(createConnectHostTool(sshToolService, logService))
  );

  return disposables;
}

function createListHostsTool(
  sshToolService: ISSHToolService,
  logService: ILogService
): IAgentTool {
  return {
    name: 'termlnk_host_list',
    label: 'Host List',
    category: 'terminal',
    description: 'List all configured SSH hosts and host groups. Returns the host tree structure including names, addresses, ports, usernames, and group hierarchy. Use flat=true for a simple list, or omit for tree structure. Use parentId to list children of a specific group. Call this before termlnk_host_connect to find the correct hostId.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'Parent group ID to list children of. If omitted, lists all root-level hosts and groups.',
        },
        flat: {
          type: 'string',
          description: 'If "true", returns a flat list instead of a tree structure.',
          enum: ['true', 'false'],
        },
      },
    },
    handler: async (args) => {
      try {
        const parentId = args.parentId as string | undefined;
        const flat = args.flat === 'true';

        const hosts = await sshToolService.listHosts(parentId, flat);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ hosts, count: hosts.length }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[HostTools]', 'list_hosts failed:', err);
        return createErrorResult(`Failed to list hosts: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createConnectHostTool(
  sshToolService: ISSHToolService,
  logService: ILogService
): IAgentTool {
  return {
    name: 'termlnk_host_connect',
    label: 'Host Connect',
    category: 'terminal',
    description: 'Initiate an SSH connection to a configured host. Creates a new SSH session and returns the session ID. After connecting, use termlnk_terminal_execute with the returned sessionId to run commands on the remote host. Before connecting, check if there is already an active session to this host using termlnk_terminal_list_sessions — avoid creating duplicate connections.',
    inputSchema: {
      type: 'object',
      properties: {
        hostId: {
          type: 'string',
          description: 'The ID of the host to connect to.',
        },
        cols: {
          type: 'number',
          description: 'Terminal width in columns. Default: 80.',
          default: 80,
        },
        rows: {
          type: 'number',
          description: 'Terminal height in rows. Default: 24.',
          default: 24,
        },
      },
      required: ['hostId'],
    },
    handler: async (args) => {
      try {
        const hostId = args.hostId as string;
        const cols = Number(args.cols) || 80;
        const rows = Number(args.rows) || 24;

        if (!hostId) {
          return createErrorResult('hostId is required.');
        }

        const result = await sshToolService.connectHost(hostId, cols, rows);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessionId: result.sessionId,
              hostId: result.hostId,
              hostLabel: result.hostLabel,
            }, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[HostTools]', 'host_connect failed:', err);
        return createErrorResult(`Failed to connect to host: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function createErrorResult(message: string): IAgentToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
