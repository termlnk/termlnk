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

import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { ToolCall } from '@earendil-works/pi-ai';
import type { IMcpRemoteTool } from '@termlnk/agent';
import { validateToolArguments } from '@earendil-works/pi-ai';
import { BehaviorSubject, Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { McpController } from './mcp.controller';

const noopLog = {
  debug: () => {},
  log: () => {},
  warn: () => {},
  error: () => {},
  deprecate: () => {},
  setLogLevel: () => {},
};

const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Search text' },
    mode: { type: 'string', enum: ['fast', 'deep'] },
    limit: { type: 'integer', minimum: 1 },
    filters: {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
        range: {
          type: 'object',
          properties: { from: { type: 'number' }, to: { type: 'number' } },
          required: ['from'],
        },
      },
      required: ['tags'],
    },
  },
  required: ['query', 'mode', 'filters'],
};

function createController(): McpController {
  const mcpService = {
    initialize: async () => {},
    remoteTools$: new Subject(),
    callTool: async () => ({}),
  };
  const registry = { tools$: new Subject(), getTools: () => [] };
  const aiAgent = {
    currentSessionId$: new BehaviorSubject<string | null>(null),
    getCurrentSessionId: () => null,
    addTools: () => {},
    removeTools: () => {},
  };
  const permission = {};
  const chatRepository = { changed$: new Subject() };
  return new McpController(mcpService as any, registry as any, aiAgent as any, permission as any, chatRepository as any, noopLog as any);
}

function convertRemote(controller: McpController, inputSchema: IMcpRemoteTool['inputSchema']): AgentTool<any> {
  const remoteTool = { serverId: 's1', serverName: 'srv', name: 'search', description: 'Search', inputSchema } as IMcpRemoteTool;
  return (controller as any)._convertRemoteToolToAgentTool(remoteTool) as AgentTool<any>;
}

function call(args: unknown): ToolCall {
  return { type: 'toolCall', id: 'c1', name: 'mcp_srv_search', arguments: args } as ToolCall;
}

describe('McpController tool schema bridging', () => {
  const controller = createController();
  const tool = convertRemote(controller, INPUT_SCHEMA as any);

  it('hands the MCP JSON schema to pi unchanged', () => {
    expect(tool.parameters).toEqual(INPUT_SCHEMA);
  });

  it('accepts arguments that satisfy nested objects, enums, arrays and optional fields', () => {
    const args = { query: 'q', mode: 'deep', filters: { tags: ['a', 'b'], range: { from: 1 } } };
    expect(validateToolArguments(tool, call(args))).toEqual(args);

    // limit and filters.range are optional
    const minimal = { query: 'q', mode: 'fast', filters: { tags: [] } };
    expect(validateToolArguments(tool, call(minimal))).toEqual(minimal);
  });

  it('rejects arguments that violate the schema', () => {
    expect(() => validateToolArguments(tool, call({ query: 'q', mode: 'slow', filters: { tags: [] } }))).toThrow();
    expect(() => validateToolArguments(tool, call({ query: 'q', mode: 'fast' }))).toThrow();
    expect(() => validateToolArguments(tool, call({ query: 'q', mode: 'fast', filters: { tags: [{ a: 1 }] } }))).toThrow();
    expect(() => validateToolArguments(tool, call({ query: 'q', mode: 'fast', filters: { tags: [], range: {} } }))).toThrow();
  });

  it('falls back to an empty object schema when the server sends none', () => {
    const bare = convertRemote(controller, undefined as any);
    expect(bare.parameters).toEqual({ type: 'object' });
    expect(validateToolArguments(bare, call({}))).toEqual({});
  });
});
