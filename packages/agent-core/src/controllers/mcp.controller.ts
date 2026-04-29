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

import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { IAgentTool, IMcpRemoteTool } from '@termlnk/agent';
import { Type } from '@sinclair/typebox';
import { IAgentToolRegistryService, IAIAgentService, IMcpService } from '@termlnk/agent';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ChatRepository } from '@termlnk/database';
import { sanitizeName } from '../common/sanitize-name';
import { WIDGET_TOOL_NAMES } from '../tools/widget-tools';

export class McpController extends Disposable {
  private _registeredAgentToolNames: string[] = [];
  private _latestRemoteTools: IMcpRemoteTool[] = [];
  private _syncVersion = 0;

  constructor(
    @IMcpService private readonly _mcpService: IMcpService,
    @IAgentToolRegistryService private readonly _mcpToolRegistryService: IAgentToolRegistryService,
    @IAIAgentService private readonly _aiAgentService: IAIAgentService,
    @Inject(ChatRepository) private readonly _chatRepository: ChatRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._initialize();
  }

  private async _initialize(): Promise<void> {
    try {
      await this._mcpService.initialize();

      // Watch remote tools and bridge to AI Agent
      this.disposeWithMe(
        this._mcpService.remoteTools$.subscribe((remoteTools) => {
          this._latestRemoteTools = remoteTools;
          void this._syncAgentTools();
        })
      );

      // Watch built-in tool changes
      this.disposeWithMe(
        this._mcpToolRegistryService.tools$.subscribe(() => {
          void this._syncAgentTools();
        })
      );

      this.disposeWithMe(
        this._aiAgentService.currentSessionId$.subscribe(() => {
          void this._syncAgentTools();
        })
      );

      this.disposeWithMe(
        this._chatRepository.changed$.subscribe((event) => {
          const currentSessionId = this._aiAgentService.getCurrentSessionId();
          if (!currentSessionId || event.sessionId !== currentSessionId) {
            return;
          }

          void this._syncAgentTools();
        })
      );

      this._logService.log('[McpController] MCP Client system initialized');
    } catch (err) {
      this._logService.error(`[McpController] Failed to initialize: ${err}`);
    }
  }

  private async _syncAgentTools(): Promise<void> {
    const syncVersion = this._syncVersion + 1;
    this._syncVersion = syncVersion;

    const selectedToolIds = await this._getSelectedToolIds();
    if (this._syncVersion !== syncVersion) {
      return;
    }

    const selectedToolIdSet = selectedToolIds ? new Set(selectedToolIds) : null;

    // Remove previously registered tools from Agent
    if (this._registeredAgentToolNames.length > 0) {
      this._aiAgentService.removeTools(this._registeredAgentToolNames);
      this._registeredAgentToolNames = [];
    }

    const agentTools: AgentTool<any>[] = [];

    // 1. Convert built-in tools (from IAgentToolRegistryService) to AgentTool[]
    // Widget tools are always included regardless of session selection (mirrors alma's
    // unconditional injection of widgetReadme/widgetRenderer/pieChart/barChart).
    const builtinTools = this._mcpToolRegistryService.getTools();
    for (const tool of builtinTools) {
      const builtinId = `builtin_${tool.name}`;
      const isWidgetTool = (WIDGET_TOOL_NAMES as readonly string[]).includes(tool.name);
      if (selectedToolIdSet && !selectedToolIdSet.has(builtinId) && !isWidgetTool) {
        continue;
      }
      agentTools.push(this._convertBuiltinToolToAgentTool(tool));
    }

    // 2. Convert external MCP tools to AgentTool[]
    const remoteTools = selectedToolIdSet
      ? this._latestRemoteTools.filter((tool) => selectedToolIdSet.has(tool.id))
      : this._latestRemoteTools;

    for (const remoteTool of remoteTools) {
      agentTools.push(this._convertRemoteToolToAgentTool(remoteTool));
    }

    if (agentTools.length > 0) {
      this._registeredAgentToolNames = agentTools.map((t) => t.name);
      this._aiAgentService.addTools(agentTools);
    }

    this._logService.log(`[McpController] Synced ${agentTools.length} tools to AI Agent (${builtinTools.length} builtin, ${remoteTools.length} remote)`);
  }

  private _convertBuiltinToolToAgentTool(tool: IAgentTool): AgentTool<any> {
    return {
      name: tool.name,
      label: tool.label ?? tool.name,
      description: tool.description,
      parameters: Type.Unsafe(tool.inputSchema || { type: 'object' }),
      execute: async (_toolCallId: string, params: unknown): Promise<AgentToolResult<any>> => {
        try {
          const result = await tool.handler(params as Record<string, unknown>);
          return {
            content: result.content.map((c) => {
              if (c.type === 'image') {
                return { type: 'text' as const, text: c.data ? `[image:${c.mimeType ?? 'unknown'}]` : '' };
              }
              return { type: 'text' as const, text: c.text ?? '' };
            }),
            details: result,
          };
        } catch (err) {
          this._logService.error(`[McpController] Builtin tool ${tool.name} failed: ${err}`);
          return {
            content: [{ type: 'text', text: `Error: ${err}` }],
            details: { error: String(err) },
          };
        }
      },
    };
  }

  private _convertRemoteToolToAgentTool(remoteTool: IMcpRemoteTool): AgentTool<any> {
    const toolName = `mcp_${sanitizeName(remoteTool.serverName)}_${sanitizeName(remoteTool.name)}`;
    return {
      name: toolName,
      label: `[${remoteTool.serverName}] ${remoteTool.name}`,
      description: remoteTool.description || remoteTool.name,
      parameters: Type.Unsafe(remoteTool.inputSchema || { type: 'object' }),
      execute: async (_toolCallId: string, params: unknown): Promise<AgentToolResult<any>> => {
        try {
          const result = await this._mcpService.callTool(remoteTool.serverId, remoteTool.name, params as Record<string, unknown>);
          const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          return {
            content: [{ type: 'text', text }],
            details: result,
          };
        } catch (err) {
          this._logService.error(`[McpController] Tool ${toolName} failed: ${err}`);
          return {
            content: [{ type: 'text', text: `Error: ${err}` }],
            details: { error: String(err) },
          };
        }
      },
    };
  }

  private async _getSelectedToolIds(): Promise<string[] | null> {
    const sessionId = this._aiAgentService.getCurrentSessionId();
    if (!sessionId) {
      return null;
    }

    const session = await this._chatRepository.getSession(sessionId);
    if (!session || !Array.isArray(session.selectedToolIds)) {
      return null;
    }

    return session.selectedToolIds.filter((id): id is string => typeof id === 'string');
  }

  override dispose(): void {
    if (this._registeredAgentToolNames.length > 0) {
      this._aiAgentService.removeTools(this._registeredAgentToolNames);
      this._registeredAgentToolNames = [];
    }
    super.dispose();
  }
}
