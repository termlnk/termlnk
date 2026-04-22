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

import type { ExternalAgentType, IAgentHookEvent, IAgentHookRegistryService, IAgentHookServerService, IAskUserQuestion, IAskUserQuestionSet, IKeyboardInjectorService, IPendingInteractionPayload, IPermissionDecision } from '@termlnk/agent';
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
import { IAgentHookRegistryService as IAgentHookRegistryServiceId, IAgentMonitorService, IKeyboardInjectorService as IKeyboardInjectorServiceId } from '@termlnk/agent';
import { Disposable, IConfigService, ILogService, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { AGENT_CORE_PLUGIN_CONFIG_KEY } from '../../controllers/config.schema';
import { buildQuestionSetSequence } from './keyboard-sequence';

/** Maximum request body size (64 KB) */
const MAX_BODY_SIZE = 64 * 1024;

/** How long to wait for user to respond to a blocking interaction (ms) */
const INTERACTION_TIMEOUT_MS = 120_000;

/**
 * Non-blocking AskUserQuestion pending records stay in memory until the
 * agent's post-tool-use fires (signalling the question was answered, in
 * CLI TUI or via keyboard injection). This is the hard cap that prevents
 * indefinite leaks when an agent dies mid-question.
 */
const QUESTION_PENDING_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Discovery file name (written inside the shared Termlnk config root).
 * Must stay in sync with `RUNTIME_FILE` in packages/agent-hook-cli/src/helper.js.
 */
const RUNTIME_FILE_NAME = 'runtime.json';
const RUNTIME_SCHEMA_VERSION = 1;

/** Blocking HTTP routes handled by the hook server. */
const ROUTE_PERMISSION = '/hook/permission';
const ROUTE_QUESTION = '/hook/ask-user-question';

/**
 * Internal record tying a pending interaction to its HTTP plumbing. Two
 * shapes share the same type:
 *
 * - `mode: 'blocking'` — the HTTP response stays open until the user
 *   decides (permission approvals always; AskUserQuestion when keyboard
 *   injection is not available). `_sendResponse` writes the body.
 *
 * - `mode: 'non-blocking'` — we already wrote `{}` back to the hook
 *   helper and released the HTTP response, because the CLI TUI is
 *   rendering the picker natively. The island still shows the payload
 *   and can respond; `respondPermission` answers by synthesising keys
 *   into the terminal app instead of writing HTTP.
 */
interface IPendingRecord {
  readonly payload: IPendingInteractionPayload;
  readonly mode: 'blocking' | 'non-blocking';
  /** Live HTTP response; null once we've released it (non-blocking + answered). */
  res: ServerResponse | null;
  readonly timeoutId: ReturnType<typeof setTimeout>;
  /** Raw tool input as the agent sent it — reused when formatting answers. */
  readonly toolInput: Record<string, unknown>;
  /** Parsed question set (only for `kind: 'question'`). */
  readonly questionSet: IAskUserQuestionSet | undefined;
  /**
   * Alias for the first question in the set — preserved alongside
   * `questionSet` so existing single-question code paths (keyboard
   * injection, log lines) keep reading `record.question` verbatim during
   * the rollout window.
   *
   * @deprecated Read `questionSet.questions[0]` directly.
   */
  readonly question: IAskUserQuestion | undefined;
}

export class AgentHookServerService extends Disposable implements IAgentHookServerService {
  private _server: Server | null = null;
  private readonly _port$ = new BehaviorSubject<number>(0);
  readonly port$: Observable<number> = this._port$.asObservable();
  private readonly _token: string;

  /** Blocking interactions keyed by requestId. */
  private readonly _pending = new Map<string, IPendingRecord>();
  private readonly _pendingInteractions$ = new BehaviorSubject<IPendingInteractionPayload[]>([]);
  readonly pendingInteractions$: Observable<IPendingInteractionPayload[]> = this._pendingInteractions$.asObservable();

  /** Whether to expose `runtime.json` so external-terminal agents can discover us. */
  private _externalMonitorEnabled = false;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @IAgentMonitorService private readonly _agentMonitorService: IAgentMonitorService,
    @IAgentHookRegistryServiceId private readonly _hookRegistryService: IAgentHookRegistryService,
    @IKeyboardInjectorServiceId private readonly _keyboardInjector: IKeyboardInjectorService
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
   * Auto-close any pending AskUserQuestion when the agent reports a
   * matching `post-tool-use` event. This fires both when the CLI TUI
   * user answers natively and when an island-pick gets injected as
   * keystrokes — the agent sees the tool finish either way, and this
   * is our one signal to retire the island picker. Idempotent with the
   * `_removePending` call inside `respondPermission`.
   */
  private _watchForQuestionDismissal(): void {
    this.disposeWithMe(
      this._agentMonitorService.hookEvent$.subscribe((event) => {
        if (event.event !== 'post-tool-use' && event.event !== 'post-tool-use-failure') {
          return;
        }
        const payload = event.payload ?? {};
        const toolName = (payload.tool_name as string) || (payload.toolName as string);
        if (toolName !== 'AskUserQuestion') {
          return;
        }
        const toolUseId = (payload.tool_use_id as string) || (payload.toolUseId as string);
        if (toolUseId) {
          this.dismissQuestionByToolUseId(toolUseId);
        }
      })
    );
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

    this._logService.log('[AgentHookServer]', `Decision ${decision.kind} for ${requestId} (${pending.payload.kind}, ${pending.mode})`);

    const isAnswerDecision = decision.kind === 'answer' || decision.kind === 'answers';
    if (pending.mode === 'non-blocking' && pending.payload.kind === 'question' && isAnswerDecision) {
      // CLI TUI is showing the picker; synthesise keystrokes so the user's
      // island-pick drives it. The post-tool-use hook will come back
      // shortly and call `dismissQuestionByToolUseId` (idempotent with our
      // immediate `_removePending` below).
      void this._injectDecisionIntoCli(pending, decision);
      this._removePending(requestId);
      return;
    }

    // Blocking path: write the decision to the still-open HTTP response.
    this._sendResponse(pending, decision);
    this._removePending(requestId);
  }

  dismissQuestionByToolUseId(toolUseId: string): void {
    if (!toolUseId) {
      return;
    }
    for (const [requestId, record] of this._pending) {
      if (record.payload.kind === 'question' && record.payload.toolUseId === toolUseId) {
        this._logService.log(
          '[AgentHookServer]',
          `Dismissing question ${requestId} (toolUseId=${toolUseId}) — CLI TUI answered`
        );
        this._removePending(requestId);
        return;
      }
    }
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
   * Register an interaction and surface it to the island. Permission
   * approvals are always blocking (island is the sole responder).
   * AskUserQuestion is non-blocking when keyboard injection is available
   * (HTTP response closes immediately with `{}` so Claude Code renders
   * its own picker; island-picks are replayed as synthesised keystrokes
   * into the terminal app). When injection is unavailable, question
   * falls back to blocking behaviour — same as before this refactor.
   *
   * Either way the monitor receives a synthetic `permission-request`
   * event so the session phase flips to `waiting-approval`.
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
    // AskUserQuestion picker — if yes, upgrade to `kind: 'question'` so
    // the island renders the structured UI instead of a JSON dump.
    const adapter = this._hookRegistryService.getAdapter(event.agent);
    const parsedSet = adapter?.parseQuestion(toolName, toolInput) ?? undefined;
    const effectiveKind: 'question' | 'permission' = parsedSet ? 'question' : kind;
    const firstQuestion = parsedSet?.questions[0];

    // Trace the parsed shape so field-drift bugs (agent shipped multiSelect
    // but the island rendered single-pick) are diagnosable from logs alone.
    // Logged only on a successful parse — noise-free for non-question paths.
    if (parsedSet) {
      this._logService.log(
        '[AgentHookServer]',
        `questionSet agent=${event.agent} tool=${toolName} count=${parsedSet.questions.length}`
      );
      for (const [i, q] of parsedSet.questions.entries()) {
        this._logService.log(
          '[AgentHookServer]',
          `  q[${i}] id=${q.id} multiSelect=${q.multiSelect === true} `
          + `allowCustom=${q.allowCustom === true} isSecret=${q.isSecret === true} opts=${q.options.length}`
        );
      }
    }

    const payload: IPendingInteractionPayload = effectiveKind === 'question' && parsedSet && firstQuestion
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
        question: firstQuestion,
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

    // Capability gate — keyboard injection only understands a single
    // `DOWN×N + ENTER` sequence, which covers single-pick single-question
    // prompts. Any multiSelect / allowCustom / isSecret / multi-question
    // payload needs the island to be the authoritative responder instead,
    // so we force blocking mode (the HTTP response stays open until the
    // user submits). Single-pick single-question Claude Code prompts on
    // macOS with Accessibility keep the existing fast non-blocking
    // mirroring behaviour.
    const isQuestion = effectiveKind === 'question';
    const mode: 'blocking' | 'non-blocking'
      = isQuestion && this._keyboardInjector.supported && isInjectionSafe(parsedSet)
        ? 'non-blocking'
        : 'blocking';

    // Questions (blocking or not) get the longer window — multi-question,
    // multi-select, or free-text picks take more deliberation than a
    // plain allow/deny. Only classic permission prompts use the shorter
    // INTERACTION timeout.
    const timeoutMs = isQuestion ? QUESTION_PENDING_TIMEOUT_MS : INTERACTION_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      const rec = this._pending.get(requestId);
      if (!rec) {
        return;
      }
      if (rec.mode === 'blocking') {
        this._logService.log('[AgentHookServer]', `Interaction timeout for ${requestId}, auto-deny`);
        this._sendResponse(rec, { kind: 'deny' });
      } else {
        this._logService.log('[AgentHookServer]', `Question ${requestId} expired (post-tool-use never arrived)`);
      }
      this._removePending(requestId);
    }, timeoutMs);

    this._pending.set(requestId, {
      payload,
      mode,
      res: mode === 'non-blocking' ? null : res,
      timeoutId,
      toolInput,
      questionSet: parsedSet,
      question: firstQuestion,
    });

    if (mode === 'non-blocking') {
      // Release the HTTP response immediately so the agent's hook helper
      // returns `{}` (no opinion) and Claude Code falls through to its
      // own CLI TUI picker. The island still shows the pending payload.
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      }
    } else {
      res.on('close', () => {
        if (this._pending.has(requestId)) {
          this._removePending(requestId);
        }
      });
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

  /**
   * Hand off an answered question to the keyboard injector. Drives the
   * CLI TUI for the full decision shape — single label, multi-select
   * labels, and free-text "Other" inputs all go through the same token
   * sequence builder.
   *
   * Failure is logged but swallowed — the user can still respond in the
   * CLI TUI (which is still visible because the HTTP response was
   * released immediately when the record was enqueued in non-blocking
   * mode).
   */
  private async _injectDecisionIntoCli(
    record: IPendingRecord,
    decision: IPermissionDecision
  ): Promise<void> {
    const payload = record.payload;
    if (payload.kind !== 'question') {
      return;
    }
    const session = this._agentMonitorService.getSession(payload.terminalSessionId);
    if (!session) {
      this._logService.warn(
        '[AgentHookServer]',
        `Question answered for unknown session ${payload.terminalSessionId}; skipping injection`
      );
      return;
    }
    const questionSet = record.questionSet
      ?? (record.question ? { questions: [record.question] } : undefined);
    if (!questionSet) {
      this._logService.warn(
        '[AgentHookServer]',
        `Question record for ${payload.requestId} has no questionSet; skipping injection`
      );
      return;
    }
    const sequence = buildQuestionSetSequence(questionSet, decision);
    if (!sequence) {
      this._logService.warn(
        '[AgentHookServer]',
        `Decision shape for ${payload.requestId} not injectable (isSecret or empty); user must pick in the CLI TUI`
      );
      return;
    }
    const ok = await this._keyboardInjector.injectSequence(session, sequence);
    if (!ok) {
      this._logService.warn(
        '[AgentHookServer]',
        `Keyboard injection failed for ${payload.requestId}; user must pick in the CLI TUI`
      );
    }
  }

  private _deriveSource(sessionId: string): 'internal' | 'external' {
    if (!sessionId || sessionId === 'unknown' || sessionId.startsWith('external-')) {
      return 'external';
    }
    return 'internal';
  }

  // ---------------------------------------------------------------------------
  // Response delivery
  // ---------------------------------------------------------------------------

  private _sendResponse(pending: IPendingRecord, decision: IPermissionDecision): void {
    const { res, payload } = pending;
    if (!res || res.headersSent) {
      // Non-blocking records already released the response, and blocking
      // records that lost their socket (helper disconnected) should be
      // skipped rather than throw.
      return;
    }

    const adapter = this._hookRegistryService.getAdapter(payload.agent);
    // Fall back to a minimal generic deny/allow body when no adapter owns
    // this agent (e.g. unknown agent surfaced via raw `/hook/permission`).
    const body = adapter
      ? adapter.formatResponse(decision, {
        isQuestion: payload.kind === 'question',
        toolInput: pending.toolInput,
        question: pending.question,
        questionSet: pending.questionSet,
      })
      : decision.kind === 'allow' ? '{}' : JSON.stringify({ decision: 'block' });

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
      // Deny blocking interactions on shutdown — auto-allow would be a
      // security risk. Non-blocking questions already returned `{}` to
      // the helper and have nothing more to send.
      if (pending.mode === 'blocking' && pending.res && !pending.res.headersSent) {
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

/**
 * Keyboard injection now speaks the full AskUserQuestion CLI grammar
 * (see {@link buildQuestionSetSequence}): multi-question sets, multi-
 * select toggles, and free-text "Other" entries all drive the TUI via
 * synthesised keystrokes. The only shape still reserved for the
 * blocking HTTP path is `isSecret`, where routing passwords or tokens
 * through the accessibility bridge is deliberately refused.
 */
function isInjectionSafe(set: IAskUserQuestionSet | undefined): boolean {
  if (!set || set.questions.length === 0) {
    return false;
  }
  for (const q of set.questions) {
    if (q.isSecret === true) {
      return false;
    }
  }
  return true;
}
