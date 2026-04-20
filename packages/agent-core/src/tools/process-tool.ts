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
import { cpus, freemem, homedir, hostname, platform, release, totalmem, uptime } from 'node:os';
import process from 'node:process';

export function registerProcessTool(
  toolRegistry: IAgentToolRegistryService,
  logService: ILogService
): IDisposable {
  return toolRegistry.registerTool(createProcessInfoTool(logService));
}

function createProcessInfoTool(logService: ILogService): IAgentTool {
  return {
    name: 'termlnk_system_info',
    label: 'System Info',
    category: 'other',
    description: 'Get local system resource information including OS details, CPU model/cores, memory usage, and Node.js process stats. This only reports the local machine — for remote host info, use termlnk_terminal_execute with commands like uname, free, df, or top instead.',
    isReadOnly: true,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      try {
        const cpuInfo = cpus();
        const totalMem = totalmem();
        const freeMem = freemem();
        const usedMem = totalMem - freeMem;

        const processMem = process.memoryUsage();

        const info = {
          os: {
            platform: platform(),
            release: release(),
            hostname: hostname(),
            homeDir: homedir(),
            uptime: formatUptime(uptime()),
          },
          cpu: {
            model: cpuInfo[0]?.model ?? 'unknown',
            cores: cpuInfo.length,
          },
          memory: {
            total: formatBytes(totalMem),
            used: formatBytes(usedMem),
            free: formatBytes(freeMem),
            usagePercent: `${((usedMem / totalMem) * 100).toFixed(1)}%`,
          },
          process: {
            nodeVersion: process.version,
            pid: process.pid,
            memoryUsage: {
              rss: formatBytes(processMem.rss),
              heapUsed: formatBytes(processMem.heapUsed),
              heapTotal: formatBytes(processMem.heapTotal),
            },
          },
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(info, null, 2),
          }],
        };
      } catch (err) {
        logService.error('[ProcessInfoTool]', 'failed:', err);
        return createErrorResult(`Failed to get process info: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function createErrorResult(message: string): IAgentToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
