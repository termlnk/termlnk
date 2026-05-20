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

import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { IAgentPluginConfig, IAgentTool, IAgentToolInputSchema, IMcpConfig, IMyMcpServer, IMyMcpService } from '@termlnk/agent';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Subscription } from 'rxjs';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { AGENT_PLUGIN_CONFIG_KEY, IAgentToolRegistryService } from '@termlnk/agent';
import { Disposable, IConfigService, ILogService } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { z } from 'zod';

interface ISessionEntry {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  registeredTools: Map<string, RegisteredTool>;
}

export class MyMcpService extends Disposable implements IMyMcpService {
  // stdio mode
  private _server: McpServer | null = null;
  private _transport: StdioServerTransport | null = null;
  private _registeredTools = new Map<string, RegisteredTool>();

  // http mode
  private _httpServer: Server | null = null;
  private _sessions = new Map<string, ISessionEntry>();
  private _toolsSyncSubscription: Subscription | null = null;
  private _serverName = 'termlnk';
  private _serverVersion = '0.1.0';

  private readonly _isRunning$ = new BehaviorSubject<boolean>(false);
  readonly isRunning$ = this._isRunning$.asObservable();

  private readonly _serverInfo$ = new BehaviorSubject<IMyMcpServer | null>(null);
  readonly serverInfo$ = this._serverInfo$.asObservable();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @IAgentToolRegistryService private readonly _toolRegistryService: IAgentToolRegistryService
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this._server || this._httpServer) {
      this._logService.warn('[MCPServerService]', 'Server is already running.');
      return;
    }

    const agentConfig = this._configService.getConfig<IAgentPluginConfig>(AGENT_PLUGIN_CONFIG_KEY);
    const config = agentConfig?.mcp;
    const transport = config?.transport ?? 'http';

    if (transport === 'stdio') {
      await this._startStdio(config ?? undefined);
    } else {
      await this._startHttp(config ?? undefined);
    }
  }

  async stop(): Promise<void> {
    if (!this._server && !this._httpServer) {
      return;
    }

    this._logService.log('[MCPServerService]', 'Stopping MCP server...');

    if (this._server) {
      try {
        await this._server.close();
      } catch (err) {
        this._logService.warn('[MCPServerService]', 'Error while closing stdio server:', err);
      }
      this._server = null;
      this._transport = null;
      this._registeredTools.clear();
    }

    if (this._httpServer) {
      // Close all sessions
      for (const [sessionId, session] of this._sessions) {
        try {
          await session.server.close();
        } catch (err) {
          this._logService.warn('[MCPServerService]', `Error closing session ${sessionId}:`, err);
        }
      }
      this._sessions.clear();

      // Close HTTP server
      await new Promise<void>((resolve) => {
        this._httpServer!.close(() => resolve());
      });
      this._httpServer = null;

      this._toolsSyncSubscription?.unsubscribe();
      this._toolsSyncSubscription = null;
    }

    this._isRunning$.next(false);
    this._serverInfo$.next(null);

    this._logService.log('[MCPServerService]', 'MCP server stopped.');
  }

  private async _startStdio(config: IMcpConfig | undefined): Promise<void> {
    const serverName = config?.serverName ?? 'termlnk';
    const serverVersion = config?.serverVersion ?? '0.1.0';

    this._logService.log('[MCPServerService]', `Starting MCP server (stdio): ${serverName} v${serverVersion}`);

    this._server = this._createMcpServer(serverName, serverVersion);

    const subscription = this._toolRegistryService.tools$.subscribe((tools) => {
      if (this._server) {
        this._syncToolsOnServer(this._server, this._registeredTools, tools);
      }
    });
    this.disposeWithMe(() => subscription.unsubscribe());

    this._transport = new StdioServerTransport();
    await this._server.connect(this._transport);

    this._isRunning$.next(true);
    this._serverInfo$.next({ name: serverName, version: serverVersion, transport: 'stdio' });

    this._logService.log('[MCPServerService]', 'MCP server started successfully (stdio).');
  }

  private async _startHttp(config: IMcpConfig | undefined): Promise<void> {
    this._serverName = config?.serverName ?? 'termlnk';
    this._serverVersion = config?.serverVersion ?? '0.1.0';
    const port = config?.port ?? 23580;
    const host = config?.host ?? '0.0.0.0';

    this._logService.log('[MCPServerService]', `Starting MCP server (http): ${this._serverName} v${this._serverVersion} on ${host}:${port}`);

    // Subscribe to tool changes to sync to all active sessions
    this._toolsSyncSubscription = this._toolRegistryService.tools$.subscribe((tools) => {
      for (const [, session] of this._sessions) {
        this._syncToolsOnServer(session.server, session.registeredTools, tools);
      }
    });

    this._httpServer = createServer((req, res) => {
      this._handleHttpRequest(req, res).catch((err) => {
        this._logService.error('[MCPServerService]', 'Error handling HTTP request:', err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this._httpServer!.listen(port, host, () => resolve());
      this._httpServer!.once('error', reject);
    });

    this._isRunning$.next(true);
    this._serverInfo$.next({ name: this._serverName, version: this._serverVersion, transport: 'http', port, host });

    this._logService.log('[MCPServerService]', `MCP server started successfully (http) on ${host}:${port}.`);
  }

  private async _handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    if (url.pathname !== '/mcp') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'POST') {
      const body = await this._readJsonBody(req);

      if (sessionId && this._sessions.has(sessionId)) {
        await this._sessions.get(sessionId)!.transport.handleRequest(req, res, body);
      } else if (!sessionId || this._isInitMessage(body)) {
        await this._createSessionAndHandle(req, res, body);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or missing session' }));
      }
    } else if (req.method === 'GET' || req.method === 'DELETE') {
      if (sessionId && this._sessions.has(sessionId)) {
        await this._sessions.get(sessionId)!.transport.handleRequest(req, res);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or missing session' }));
      }
    } else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }
  }

  private async _createSessionAndHandle(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown
  ): Promise<void> {
    const server = this._createMcpServer(this._serverName, this._serverVersion);
    const registeredTools = new Map<string, RegisteredTool>();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        this._sessions.set(sessionId, { server, transport, registeredTools });
        this._logService.log('[MCPServerService]', `HTTP session initialized: ${sessionId}`);
      },
      onsessionclosed: (sessionId) => {
        this._sessions.delete(sessionId);
        this._logService.log('[MCPServerService]', `HTTP session closed: ${sessionId}`);
      },
    });

    // Register current tools on the new session's server
    const currentTools = this._toolRegistryService.getTools();
    this._syncToolsOnServer(server, registeredTools, currentTools);

    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  private _createMcpServer(name: string, version: string): McpServer {
    return new McpServer(
      { name, version },
      { capabilities: { tools: { listChanged: true } } }
    );
  }

  private _syncToolsOnServer(
    server: McpServer,
    registeredTools: Map<string, RegisteredTool>,
    tools: IAgentTool[]
  ): void {
    const currentNames = new Set(registeredTools.keys());
    const newNames = new Set(tools.map((t) => t.name));

    for (const name of currentNames) {
      if (!newNames.has(name)) {
        registeredTools.get(name)?.remove();
        registeredTools.delete(name);
      }
    }

    // Register new tools
    for (const tool of tools) {
      if (!currentNames.has(tool.name)) {
        const zodShape = toZodShape(tool.inputSchema);
        const registered = server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: zodShape,
          },
          async (args): Promise<CallToolResult> => {
            try {
              return await tool.handler(args as Record<string, unknown>) as CallToolResult;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              this._logService.error('[MCPServerService]', `Tool "${tool.name}" failed:`, err);
              return {
                content: [{ type: 'text', text: `Error executing tool "${tool.name}": ${message}` }],
                isError: true,
              };
            }
          }
        );
        registeredTools.set(tool.name, registered);
      }
    }
  }

  private _isInitMessage(body: unknown): boolean {
    if (Array.isArray(body)) {
      return body.some((msg) => isInitializeRequest(msg));
    }
    return isInitializeRequest(body);
  }

  private _readJsonBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString();
          resolve(raw ? JSON.parse(raw) : undefined);
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  override dispose(): void {
    void this.stop();
    this._isRunning$.complete();
    this._serverInfo$.complete();
    super.dispose();
  }
}

function toZodShape(schema: IAgentToolInputSchema): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  const required = new Set(schema.required ?? []);

  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    let zodType: z.ZodType;

    switch (prop.type) {
      case 'string':
        zodType = prop.enum
          ? z.enum(prop.enum as [string, ...string[]])
          : z.string();
        break;
      case 'number':
      case 'integer':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      default:
        zodType = z.unknown();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (!required.has(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return shape;
}
