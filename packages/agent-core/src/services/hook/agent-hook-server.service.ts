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

import type { ExternalAgentType, IAgentHookEvent, IAgentHookRegistryService, IAgentHookServerService, IPendingInteractionPayload, IPermissionDecision } from '@termlnk/agent';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Observable } from 'rxjs';
import type { IAgentCorePluginConfig } from '../../controllers/config.schema';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import process from 'node:process';
import { IAgentHookRegistryService as IAgentHookRegistryServiceId, IAgentMonitorService } from '@termlnk/agent';
import { Disposable, IConfigService, ILogService, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { AGENT_CORE_PLUGIN_CONFIG_KEY } from '../../controllers/config.schema';

/** Maximum request body size (64 KB) */
const MAX_BODY_SIZE = 64 * 1024;

/** How long to wait for user to respond to a blocking permission request (ms). */
const PERMISSION_TIMEOUT_MS = 120_000;

/**
 * Hard cap for pending AskUserQuestion entries. The hook HTTP response is
 * released immediately with `{}`, but we keep the payload in
 * `pendingInteractions$` so the island pet can render its Question state
 * until the agent's `post-tool-use` arrives. 10 minutes prevents leaks if
 * the agent dies mid-question.
 */
const QUESTION_PENDING_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Discovery file name (written inside the shared Termlnk config root).
 * Must stay in sync with `RUNTIME_FILE` in packages/agent-hook-cli/src/helper.js.
 */
const RUNTIME_FILE_NAME = 'runtime.json';
const RUNTIME_SCHEMA_VERSION = 1;

/** HTTP routes handled by the hook server. */
const ROUTE_PERMISSION = '/hook/permission';
const ROUTE_QUESTION = '/hook/ask-user-question';

/**
 * Internal record tying a pending interaction to its HTTP / lifecycle plumbing.
 *
 * - `kind: 'permission'` — HTTP response stays open until the user picks
 *   allow/deny in the island, or the 120 s timeout fires (auto-deny).
 * - `kind: 'question'` — HTTP response is already closed (released with
 *   `{}` at enqueue time). The record survives in `_pending` purely to
 *   drive the island pet's Question state; cleared on `post-tool-use` or
 *   the 10-min safety timeout.
 */
interface IPendingRecord {
  readonly payload: IPendingInteractionPayload;
  /** Live HTTP response; null for question records (already released). */
  res: ServerResponse | null;
  readonly timeoutId: ReturnType<typeof setTimeout>;
}

export class AgentHookServerService extends Disposable implements IAgentHookServerService {
  private _server: Server | null = null;
  private readonly _port$ = new BehaviorSubject<number>(0);
  readonly port$: Observable<number> = this._port$.asObservable();
  private readonly _token: string;

  private readonly _pending = new Map<string, IPendingRecord>();
  private readonly _pendingInteractions$ = new BehaviorSubject<IPendingInteractionPayload[]>([]);
  readonly pendingInteractions$: Observable<IPendingInteractionPayload[]> = this._pendingInteractions$.asObservable();

  /** Whether to expose `runtime.json` so external-terminal agents can discover us. */
  private _externalMonitorEnabled = false;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @IAgentMonitorService private readonly _agentMonitorService: IAgentMonitorService,
    @IAgentHookRegistryServiceId private readonly _hookRegistryService: IAgentHookRegistryService
  ) {
    super();
    this._token = randomBytes(32).toString('hex');
    this.disposeWithMe(toDisposable(() => {
      this._port$.complete();
      this._pendingInteractions$.complete();
      this._cleanupAllPending();
      this._withdrawRuntimeInfo();
    }));
    this._watchForQuestionDismissal();
  }

  /**
   * Dismiss any pending AskUserQuestion for a session as soon as that
   * session resumes activity. Claude Code does NOT fire PostToolUse for
   * AskUserQuestion (anthropics/claude-code#15872, #44326), so we cannot
   * rely on a precise tool-use-id match. The reliable signal is "the
   * agent did *something else* in this session" — the next tool ran,
   * the turn finished, or the user submitted a new prompt. Any of those
   * proves the question is no longer waiting.
   *
   * `pre-tool-use` is intentionally excluded: the matcher: `*` PreToolUse
   * fires *concurrently* with our `ask-user-question` enqueue, which
   * would race-cancel the pending we just registered.
   */
  private _watchForQuestionDismissal(): void {
    this.disposeWithMe(
      this._agentMonitorService.hookEvent$.subscribe((event) => {
        switch (event.event) {
          case 'post-tool-use':
          case 'post-tool-use-failure':
          case 'stop':
          case 'stop-failure':
          case 'prompt-submit':
            this._dismissQuestionsForSession(event.sessionId, event.event);
            break;
          default:
            // Other events keep the question pending.
        }
      })
    );
  }

  private _dismissQuestionsForSession(sessionId: string, reason: string): void {
    if (!sessionId || sessionId === 'unknown') {
      return;
    }
    const toRemove: string[] = [];
    for (const [requestId, record] of this._pending) {
      if (record.payload.kind === 'question' && record.payload.terminalSessionId === sessionId) {
        toRemove.push(requestId);
      }
    }
    for (const requestId of toRemove) {
      this._logService.log(
        '[AgentHookServer]',
        `Dismissing question ${requestId} via ${reason} on session ${sessionId}`
      );
      this._removePending(requestId);
    }
  }

  get token(): string {
    return this._token;
  }

  getPort(): number {
    return this._port$.getValue();
  }

  async start(): Promise<void> {
    if (this._server) {
      return;
    }

    this._server = createServer((req, res) => {
      this._handleRequest(req, res).catch((err) => {
        this._logService.error('[AgentHookServer]', 'Request error:', err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this._server!.listen(0, '127.0.0.1', () => {
        const addr = this._server!.address() as AddressInfo;
        this._port$.next(addr.port);
        this._logService.log('[AgentHookServer]', `Listening on 127.0.0.1:${addr.port}`);
        resolve();
      });
      this._server!.once('error', reject);
    });

    if (this._externalMonitorEnabled) {
      this._publishRuntimeInfo(this._port$.getValue());
    }
  }

  async stop(): Promise<void> {
    if (!this._server) {
      return;
    }
    this._cleanupAllPending();
    this._withdrawRuntimeInfo();
    await new Promise<void>((resolve) => {
      this._server!.close(() => resolve());
    });
    this._server = null;
    this._port$.next(0);
  }

  async setExternalMonitorEnabled(enabled: boolean): Promise<void> {
    if (this._externalMonitorEnabled === enabled) {
      return;
    }
    this._externalMonitorEnabled = enabled;
    const port = this._port$.getValue();
    if (enabled && port > 0) {
      this._publishRuntimeInfo(port);
    } else {
      this._withdrawRuntimeInfo();
    }
  }

  respondPermission(requestId: string, decision: IPermissionDecision): void {
    const pending = this._pending.get(requestId);
    if (!pending) {
      this._logService.warn('[AgentHookServer]', `No pending interaction for requestId: ${requestId}`);
      return;
    }

    if (pending.payload.kind !== 'permission') {
      this._logService.warn(
        '[AgentHookServer]',
        `Ignoring respondPermission for non-permission interaction ${requestId} (kind=${pending.payload.kind})`
      );
      return;
    }

    this._logService.log('[AgentHookServer]', `Decision ${decision.kind} for ${requestId}`);
    this._sendResponse(pending, decision);
    this._removePending(requestId);
  }

  override dispose(): void {
    void this.stop();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Request handling
  // ---------------------------------------------------------------------------

  private async _handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST' || !req.url?.startsWith('/hook')) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${this._token}`) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    const body = await this._readJsonBody(req);
    if (!body || typeof body !== 'object') {
      res.writeHead(400);
      res.end('Invalid JSON');
      return;
    }

    const event = this._normaliseEvent(body as IAgentHookEvent, req.url);

    if (req.url.startsWith(ROUTE_QUESTION)) {
      this._enqueueInteraction('question', event, res);
      return;
    }
    if (req.url.startsWith(ROUTE_PERMISSION)) {
      this._enqueueInteraction('permission', event, res);
      return;
    }

    // Fire-and-forget monitoring route.
    this._agentMonitorService.handleHookEvent(event);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  }

  /**
   * Ensure `event.agent` is populated. Legacy helpers fall back to a URL
   * segment like `/hook/claude-code` → `{ agent: 'claude-code' }` so the
   * server can still identify the caller when payload omits it.
   */
  private _normaliseEvent(event: IAgentHookEvent, url: string): IAgentHookEvent {
    if (event.agent && event.agent !== 'unknown') {
      return event;
    }
    const parts = url.split('/').filter(Boolean);
    const candidate = parts[1];
    if (parts.length >= 2 && candidate && candidate !== 'permission' && candidate !== 'ask-user-question') {
      return { ...event, agent: candidate as ExternalAgentType };
    }
    return event;
  }

  /**
   * Register an interaction and surface it to the island.
   *
   * - **permission** — blocking. HTTP response stays open until the user
   *   resolves via {@link respondPermission}; 120 s timeout auto-denies.
   * - **question** — non-blocking. HTTP response closes immediately with
   *   `{}` so every agent's CLI TUI renders its own picker natively. The
   *   payload still lands in `pendingInteractions$` so the island pet
   *   flips to its Question state; cleared on `post-tool-use`.
   *
   * Either way the monitor receives a synthetic `permission-request` event
   * so the session phase flips to `waiting-approval`.
   */
  private _enqueueInteraction(
    kind: 'permission' | 'question',
    event: IAgentHookEvent,
    res: ServerResponse
  ): void {
    const payloadRaw = event.payload ?? {};
    const toolName = (payloadRaw.tool_name as string) || (payloadRaw.toolName as string) || 'unknown';
    const toolInput = (payloadRaw.tool_input as Record<string, unknown>)
      || (payloadRaw.toolInput as Record<string, unknown>)
      || {};
    const toolUseId = (payloadRaw.tool_use_id as string) || (payloadRaw.toolUseId as string);

    const requestId = randomBytes(16).toString('hex');
    const source = this._deriveSource(event.sessionId);

    // Route may be /hook/ask-user-question OR /hook/permission. Either
    // way, ask the owning adapter whether this tool looks like an
    // AskUserQuestion picker — if yes, upgrade to `kind: 'question'`.
    const adapter = this._hookRegistryService.getAdapter(event.agent);
    const parsedSet = adapter?.parseQuestion(toolName, toolInput) ?? undefined;
    const effectiveKind: 'question' | 'permission' = parsedSet ? 'question' : kind;

    const payload: IPendingInteractionPayload = effectiveKind === 'question' && parsedSet
      ? {
        kind: 'question',
        requestId,
        toolName,
        toolInput,
        toolUseId,
        terminalSessionId: event.sessionId,
        agent: event.agent,
        source,
        timestamp: Date.now(),
        questionSet: parsedSet,
      }
      : {
        kind: 'permission',
        requestId,
        toolName,
        toolInput,
        toolUseId,
        terminalSessionId: event.sessionId,
        agent: event.agent,
        source,
        timestamp: Date.now(),
      };

    const isQuestion = effectiveKind === 'question';
    const timeoutMs = isQuestion ? QUESTION_PENDING_TIMEOUT_MS : PERMISSION_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      const rec = this._pending.get(requestId);
      if (!rec) {
        return;
      }
      if (rec.payload.kind === 'permission') {
        this._logService.log('[AgentHookServer]', `Permission timeout for ${requestId}, auto-deny`);
        this._sendResponse(rec, { kind: 'deny' });
      } else {
        this._logService.log('[AgentHookServer]', `Question ${requestId} expired (post-tool-use never arrived)`);
      }
      this._removePending(requestId);
    }, timeoutMs);

    if (isQuestion) {
      // Release the HTTP response immediately with `{}` so the hook helper
      // returns "no opinion" to the agent and its CLI TUI handles the pick.
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      }
      this._pending.set(requestId, { payload, res: null, timeoutId });
    } else {
      res.on('close', () => {
        if (this._pending.has(requestId)) {
          this._removePending(requestId);
        }
      });
      this._pending.set(requestId, { payload, res, timeoutId });
    }

    this._pendingInteractions$.next([...this._pendingInteractions$.getValue(), payload]);

    // Tell the monitor this session is now waiting on user input so the
    // island status flips. Reuse `permission-request` for both kinds — the
    // monitor cares about "waiting-approval" status, not the picker shape.
    this._agentMonitorService.handleHookEvent({
      ...event,
      event: 'permission-request',
      payload: { ...payloadRaw, requestId },
    });
  }

  private _deriveSource(sessionId: string): 'internal' | 'external' {
    if (!sessionId || sessionId === 'unknown' || sessionId.startsWith('external-')) {
      return 'external';
    }
    return 'internal';
  }

  // ---------------------------------------------------------------------------
  // Response delivery (permission only)
  // ---------------------------------------------------------------------------

  private _sendResponse(pending: IPendingRecord, decision: IPermissionDecision): void {
    const { res, payload } = pending;
    if (!res || res.headersSent) {
      // Either a question record (already released) or a blocking record
      // that lost its socket — skip silently.
      return;
    }

    const adapter = this._hookRegistryService.getAdapter(payload.agent);
    let body: string;
    if (adapter) {
      body = adapter.formatResponse(decision);
    } else if (decision.kind === 'allow') {
      body = '{}';
    } else {
      body = JSON.stringify({ decision: 'block' });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  }

  private _removePending(requestId: string): void {
    const pending = this._pending.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this._pending.delete(requestId);

    const current = this._pendingInteractions$.getValue();
    const updated = current.filter((r) => r.requestId !== requestId);
    this._pendingInteractions$.next(updated);

    const hasRemaining = updated.some(
      (r) => r.terminalSessionId === pending.payload.terminalSessionId
    );
    if (!hasRemaining) {
      this._agentMonitorService.onPermissionResolved(pending.payload.terminalSessionId);
    }
  }

  private _cleanupAllPending(): void {
    for (const pending of this._pending.values()) {
      clearTimeout(pending.timeoutId);
      // Deny any live blocking interactions on shutdown — auto-allow
      // would be a security risk. Question records already returned `{}`.
      if (pending.payload.kind === 'permission' && pending.res && !pending.res.headersSent) {
        this._sendResponse(pending, { kind: 'deny' });
      }
    }
    this._pending.clear();
    this._pendingInteractions$.next([]);
  }

  // ---------------------------------------------------------------------------
  // Runtime discovery file (published so external terminal agents can find us)
  // ---------------------------------------------------------------------------

  private _resolveConfigPath(): string | null {
    const cfg = this._configService.getConfig<IAgentCorePluginConfig>(AGENT_CORE_PLUGIN_CONFIG_KEY);
    return cfg?.configPath ?? null;
  }

  private _publishRuntimeInfo(port: number): void {
    if (port <= 0) {
      return;
    }
    const configPath = this._resolveConfigPath();
    if (!configPath) {
      this._logService.warn(
        '[AgentHookServer]',
        'No configPath configured; external-terminal discovery file not published'
      );
      return;
    }
    const filePath = join(configPath, RUNTIME_FILE_NAME);
    try {
      mkdirSync(configPath, { recursive: true, mode: 0o700 });
      const payload = {
        schemaVersion: RUNTIME_SCHEMA_VERSION,
        port,
        token: this._token,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      };
      writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
      this._logService.log('[AgentHookServer]', `Published runtime info at ${filePath} (port ${port})`);
    } catch (err) {
      this._logService.warn('[AgentHookServer]', 'Failed to publish runtime info:', err);
    }
  }

  private _withdrawRuntimeInfo(): void {
    const configPath = this._resolveConfigPath();
    if (!configPath) {
      return;
    }
    try {
      unlinkSync(join(configPath, RUNTIME_FILE_NAME));
      this._logService.log('[AgentHookServer]', 'Withdrew runtime info file');
    } catch {
      // Best-effort: file may not exist yet (first start) or already removed.
    }
  }

  private _readJsonBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error('Request body too large'));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString();
          resolve(raw ? JSON.parse(raw) : undefined);
        } catch {
          // Malformed JSON — resolve with undefined so the caller can
          // return 400 instead of letting the error bubble to a 500.
          resolve(undefined);
        }
      });
      req.on('error', reject);
    });
  }
}
