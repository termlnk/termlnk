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

import type { AgentSessionStatus, ExternalAgentType, IAgentHookEvent, IAgentMonitorService, IExternalAgentSession } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import type { IIslandSettingsStored } from './agent-monitor.utils';
import process from 'node:process';
import { AGENT_DISPLAY_NAMES } from '@termlnk/agent';
import { Disposable, ILogService, Inject, INotificationService, isMacintosh, toDisposable } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { BehaviorSubject, filter, Subject } from 'rxjs';
import { EXTERNAL_SESSION_IDLE_MS, ISLAND_SETTINGS_CONFIG_KEY, isNeedsInputNotification, resolveSource, truncate, ZOMBIE_CHECK_INTERVAL_MS } from './agent-monitor.utils';
import { applyTodoTool, TODO_TOOL_NAMES } from './todos';
import { TOOL_FORMATTERS } from './tool-descriptions';

export class AgentMonitorService extends Disposable implements IAgentMonitorService {
  private readonly _sessions$ = new BehaviorSubject<IExternalAgentSession[]>([]);
  readonly sessions$: Observable<IExternalAgentSession[]> = this._sessions$.asObservable();

  private readonly _hookEvent$ = new Subject<IAgentHookEvent>();
  readonly hookEvent$: Observable<IAgentHookEvent> = this._hookEvent$.asObservable();

  /**
   * Main session index, keyed by the **canonical key** (see {@link _resolveKey}):
   * agent-native `agentSessionId` when present, otherwise the termlnk
   * transport-layer `sessionId`. Using the agent-native id avoids treating
   * one agent session as multiple entries when the hook helper's fallback
   * fingerprint would otherwise change (e.g. cwd shifts).
   */
  private readonly _sessionMap = new Map<string, IExternalAgentSession>();
  /**
   * Alias index mapping termlnk transport-layer `sessionId` → canonical key.
   * Populated whenever an event arrives with both `sessionId` and
   * `agentSessionId`, so that subsequent events that only carry `sessionId`
   * (e.g. OpenCode `permission.ask`, which omits the session id) can still
   * be routed to the correct canonical entry.
   */
  private readonly _aliasMap = new Map<string, string>();
  /**
   * Nesting depth of `Agent` tool calls per session. While depth > 0 the
   * session is inside a subagent context; todo-tool events (TaskCreate /
   * TaskUpdate) from subagents must be ignored because their task IDs are
   * scoped independently and would collide with the main agent's IDs.
   *
   * Keyed by canonical key (same as {@link _sessionMap}).
   */
  private readonly _subagentDepth = new Map<string, number>();
  private _zombieCheckInterval: ReturnType<typeof setInterval> | null = null;
  /** Cached Dynamic Island enabled flag (macOS only); false until config loads. */
  private _islandEnabled = false;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @INotificationService private readonly _notificationService: INotificationService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository
  ) {
    super();
    this.disposeWithMe(toDisposable(() => {
      this._sessions$.complete();
      this._hookEvent$.complete();
      this._sessionMap.clear();
      this._aliasMap.clear();
      this._subagentDepth.clear();
      if (this._zombieCheckInterval !== null) {
        clearInterval(this._zombieCheckInterval);
        this._zombieCheckInterval = null;
      }
    }));
    this._startZombieDetection();
    this._initIslandStateTracking();
  }

  /**
   * Track the Dynamic Island enabled flag so we can suppress duplicate OS
   * desktop notifications when the island UI is already surfacing the alert.
   * macOS-only — Windows/Linux always show desktop notifications.
   */
  private _initIslandStateTracking(): void {
    if (!isMacintosh) {
      return;
    }

    void this._refreshIslandEnabled();

    this.disposeWithMe(
      this._configRepository.changed$
        .pipe(filter((event) => event.key === ISLAND_SETTINGS_CONFIG_KEY))
        .subscribe(() => {
          void this._refreshIslandEnabled();
        })
    );
  }

  private async _refreshIslandEnabled(): Promise<void> {
    try {
      const stored = await this._configRepository
        .getField<IIslandSettingsStored>(ISLAND_SETTINGS_CONFIG_KEY, 'settings');
      // Default to enabled on macOS (matches DEFAULT_ISLAND_SETTINGS in settings-ui).
      this._islandEnabled = stored?.enabled !== false;
    } catch {
      // Keep previous value on read error.
    }
  }

  /** False when the Dynamic Island is active and will surface the alert itself. */
  private _shouldShowDesktop(): boolean {
    return !(isMacintosh && this._islandEnabled);
  }

  handleHookEvent(event: IAgentHookEvent): void {
    this._logService.log(
      '[AgentMonitor]',
      `Hook event: ${event.event} from ${event.agent} (session: ${event.sessionId})`
    );
    this._hookEvent$.next(event);

    switch (event.event) {
      case 'session-start':
        this._onSessionStart(event);
        break;
      case 'session-end':
        this._onSessionEnd(event);
        break;
      case 'prompt-submit':
        this._onPromptSubmit(event);
        break;
      case 'stop':
        this._onStop(event);
        break;
      case 'stop-failure':
        this._updateSessionStatus('stopped', event);
        break;
      case 'notification':
        this._onNotification(event);
        break;
      case 'pre-tool-use':
        this._onPreToolUse(event);
        break;
      case 'post-tool-use':
      case 'post-tool-use-failure':
        this._onPostToolUse(event);
        break;
      case 'pre-compact':
        this._updateSessionStatus('compacting', event);
        break;
      case 'post-compact':
        this._updateSessionStatus('running', event);
        break;
      case 'permission-request':
      case 'ask-user-question':
        this._onPermissionRequest(event);
        break;
      case 'subagent-start':
      case 'subagent-stop':
      case 'elicitation':
        // Pure monitoring signals — keep the session alive but do not flip
        // status or surface a desktop notification.
        this._touchSession(event);
        break;
      default:
        this._touchSession(event);
        break;
    }
  }

  getSession(terminalSessionId: string): IExternalAgentSession | undefined {
    return this._sessionMap.get(this._resolveKeyById(terminalSessionId));
  }

  getSessions(): IExternalAgentSession[] {
    return [...this._sessionMap.values()];
  }

  removeSession(terminalSessionId: string): void {
    if (this._deleteSession(this._resolveKeyById(terminalSessionId))) {
      this._emitSessions();
    }
  }

  getDisplayName(agent: ExternalAgentType): string {
    return AGENT_DISPLAY_NAMES[agent] || agent;
  }

  getSessionsByAgent(agent: ExternalAgentType): IExternalAgentSession[] {
    return this.getSessions().filter((s) => s.agent === agent);
  }

  onPermissionResolved(terminalSessionId: string): void {
    const key = this._resolveKeyById(terminalSessionId);
    const session = this._sessionMap.get(key);
    if (session && session.status === 'waiting-approval') {
      session.status = 'running';
      session.lastEventAt = Date.now();
      this._emitSessions();
      this._logService.log(
        '[AgentMonitor]',
        `Permission resolved for session ${terminalSessionId}, status -> running`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _onSessionStart(event: IAgentHookEvent): void {
    const payload = event.payload ?? {};
    const source = resolveSource(event.sessionId);
    const cwd = (payload.cwd as string | undefined) ?? event.meta?.cwd;
    const project = cwd ? cwd.split('/').pop() : undefined;
    const key = this._resolveKey(event);

    const existing = this._sessionMap.get(key);
    if (existing) {
      // Resume / re-start: keep the derived title + lastPrompt so the island
      // doesn't flicker back to "<cwd>" or lose the session subject. Only
      // refresh the things that legitimately change.
      //
      // Only promote to `running` if the session had actually stopped. For
      // any other live state (idle / needs-input / waiting-approval /
      // compacting / already running), preserve the current status — a
      // duplicated `session-start` hook (agents sometimes re-emit it on
      // reconnect) must not force WaitingForInput → Processing, which would
      // misfire a TaskAcknowledge sound even though the user submitted
      // nothing.
      if (existing.status === 'stopped') {
        existing.status = 'running';
      }
      existing.lastEventAt = Date.now();
      if (cwd && !existing.cwd) {
        existing.cwd = cwd;
      }
      if (project && !existing.project) {
        existing.project = project;
      }
      this._emitSessions();
      return;
    }

    const session: IExternalAgentSession = {
      terminalSessionId: event.sessionId,
      agent: event.agent,
      source,
      status: 'running',
      startedAt: Date.now(),
      lastEventAt: Date.now(),
      agentSessionId: event.agentSessionId,
      cwd,
      agentPid: payload.pid as number | undefined,
      project,
      // `title` stays unset until the first user prompt arrives — avoids
      // showing the cwd basename twice (we render it as a prefix).
      title: undefined,
      externalMeta: source === 'external' ? event.meta : undefined,
    };
    this._sessionMap.set(key, session);
    this._emitSessions();
    // Silent by design — session list and Dynamic Island already surface this.
  }

  private _onPromptSubmit(event: IAgentHookEvent): void {
    const session = this._sessionMap.get(this._resolveKey(event));
    if (session) {
      const payload = event.payload ?? {};
      const prompt = (payload.prompt as string)
        || (payload.stdin as string)
        || (payload.message as string)
        || '';
      if (prompt) {
        session.lastPrompt = truncate(prompt, 120);
        // Title is sticky — set once from the first prompt and keep forever
        // (so subsequent prompts don't shuffle the header). Resume scenarios
        // preserve it via the `existing` branch in _onSessionStart.
        if (!session.title) {
          session.title = truncate(prompt, 80);
        }
      }
      this._resetLastToolState(session);
    }
    this._updateSessionStatus('running', event);
  }

  private _onSessionEnd(event: IAgentHookEvent): void {
    if (this._deleteSession(this._resolveKey(event))) {
      this._emitSessions();
    }
  }

  private _onStop(event: IAgentHookEvent): void {
    // Do NOT reset last-tool state here — the island keeps showing the
    // turn's final action until the next user prompt starts a new turn.
    this._updateSessionStatus('needs-input', event);
  }

  private _onNotification(event: IAgentHookEvent): void {
    const payload = event.payload ?? {};

    // Detect if this is a "needs input" notification (permission request, etc.)
    // Route to `waiting-approval` so the phase becomes WaitingForApproval and
    // the island derives an InputRequired CESP event (correct sound). Using
    // `needs-input` here would land in WaitingForInput and misfire TaskComplete.
    if (isNeedsInputNotification(payload)) {
      this._updateSessionStatus('waiting-approval', event);
    }

    this._notificationService.notify({
      title: (payload.title as string) || `${this.getDisplayName(event.agent)} notification`,
      body: (payload.body as string) || (payload.message as string) || '',
      type: 'info',
      source: 'agent',
      groupId: event.sessionId,
      priority: 'normal',
      showDesktop: this._shouldShowDesktop(),
      metadata: { agent: event.agent, ...payload },
    });
  }

  private _onPreToolUse(event: IAgentHookEvent): void {
    const payload = event.payload ?? {};
    const toolName = (payload.tool_name as string) || (payload.toolName as string);
    const toolInput = (payload.tool_input as Record<string, unknown>)
      || (payload.toolInput as Record<string, unknown>)
      || {};
    const key = this._resolveKey(event);

    // Track subagent nesting: entering an Agent tool means subsequent
    // TaskCreate / TaskUpdate events come from a subagent whose task IDs
    // are scoped independently and must not pollute the main agent list.
    if (toolName === 'Agent') {
      const prev = this._subagentDepth.get(key) ?? 0;
      this._subagentDepth.set(key, prev + 1);
    }

    // Ensure the session exists before projecting tool state / todos onto
    // it. This is critical for external agents whose `session-start` hook
    // was missed (e.g. CLI launched before Termlnk) — the first event may
    // be a TodoWrite / TaskCreate, and if we skipped the todo projection
    // here the full-replace semantics of TodoWrite would lose the data
    // forever.
    const session = this._ensureSession(event, 'running');
    session.status = 'running';
    session.lastEventAt = Date.now();
    if (toolName) {
      const formatter = TOOL_FORMATTERS[toolName];
      session.lastToolName = toolName;
      session.lastToolDescription = formatter ? formatter.describe(toolInput) : `Using ${toolName}`;
      session.lastToolDetail = formatter?.detail?.(toolInput);
      this._logService.log('[AgentMonitor]', `Tool: ${session.lastToolDescription}`);
    }
    // Project todo-plan tool calls onto session.todos (null = not a todo
    // update). Skip when inside a subagent context (depth > 0) to avoid
    // cross-contaminating the main agent's task list.
    const inSubagent = (this._subagentDepth.get(key) ?? 0) > 0;
    if (toolName && TODO_TOOL_NAMES.has(toolName) && !inSubagent) {
      const next = applyTodoTool(toolName, toolInput, session.todos);
      if (next !== null) {
        session.todos = next;
      }
    }
    if (event.payload?.cwd) {
      session.cwd = event.payload.cwd as string;
    }
    this._emitSessions();
  }

  private _onPostToolUse(event: IAgentHookEvent): void {
    // Track subagent completion: decrement depth so subsequent todo-tool
    // events are attributed to the main agent again.
    const payload = event.payload ?? {};
    const toolName = (payload.tool_name as string) || (payload.toolName as string);
    const key = this._resolveKey(event);
    if (toolName === 'Agent') {
      const prev = this._subagentDepth.get(key) ?? 0;
      if (prev > 0) {
        this._subagentDepth.set(key, prev - 1);
      }
    }

    // Preserve last-tool state; clearing here hides fast commands
    // (bash, git) before the user can read them.
    const session = this._sessionMap.get(key);
    if (session) {
      session.lastEventAt = Date.now();
      this._emitSessions();
    }
  }

  private _onPermissionRequest(event: IAgentHookEvent): void {
    const payload = event.payload ?? {};
    const toolName = (payload.tool_name as string) || (payload.toolName as string) || 'unknown';

    this._updateSessionStatus('waiting-approval', event);

    this._notificationService.notify({
      title: `${this.getDisplayName(event.agent)} needs approval`,
      body: `Tool: ${toolName}`,
      type: 'warning',
      source: 'agent',
      groupId: event.sessionId,
      priority: 'high',
      showDesktop: this._shouldShowDesktop(),
      metadata: { agent: event.agent, toolName, ...payload },
    });
  }

  // ---------------------------------------------------------------------------
  // Zombie detection
  // ---------------------------------------------------------------------------

  private _startZombieDetection(): void {
    this._zombieCheckInterval = setInterval(() => {
      let changed = false;
      const now = Date.now();
      for (const [sessionId, session] of this._sessionMap) {
        if (session.agentPid !== undefined && !this._isPidAlive(session.agentPid)) {
          this._logService.log(
            '[AgentMonitor]',
            `Zombie detected: session ${sessionId} (PID ${session.agentPid}) is dead, removing`
          );
          this._deleteSession(sessionId);
          changed = true;
          continue;
        }
        // External agents rarely emit `session-end`; fall back to an
        // idle-window GC so the island doesn't collect ghosts forever.
        if (
          session.source === 'external'
          && session.agentPid === undefined
          && now - session.lastEventAt > EXTERNAL_SESSION_IDLE_MS
        ) {
          this._logService.log(
            '[AgentMonitor]',
            `External session ${sessionId} idle > ${EXTERNAL_SESSION_IDLE_MS}ms, removing`
          );
          this._deleteSession(sessionId);
          changed = true;
        }
      }
      if (changed) {
        this._emitSessions();
      }
    }, ZOMBIE_CHECK_INTERVAL_MS);
  }

  private _isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _updateSessionStatus(
    status: AgentSessionStatus,
    event: IAgentHookEvent
  ): void {
    const session = this._ensureSession(event, status);
    session.status = status;
    session.lastEventAt = Date.now();
    if (event.payload?.cwd) {
      session.cwd = event.payload.cwd as string;
    }
    if (!session.externalMeta && session.source === 'external' && event.meta) {
      session.externalMeta = event.meta;
    }
    this._emitSessions();
  }

  /**
   * Idempotently fetch or create the session for this event. Callers must
   * still apply their own status / timestamp updates after receiving the
   * returned reference — `_ensureSession` only guarantees the entry exists
   * with sensible defaults (used when `session-start` was missed, e.g. an
   * external agent was already running before Termlnk launched).
   */
  private _ensureSession(
    event: IAgentHookEvent,
    defaultStatus: AgentSessionStatus
  ): IExternalAgentSession {
    const key = this._resolveKey(event);
    const existing = this._sessionMap.get(key);
    if (existing) {
      return existing;
    }
    const source = resolveSource(event.sessionId);
    const session: IExternalAgentSession = {
      terminalSessionId: event.sessionId,
      agent: event.agent,
      source,
      status: defaultStatus,
      startedAt: Date.now(),
      lastEventAt: Date.now(),
      agentSessionId: event.agentSessionId,
      cwd: (event.payload?.cwd as string) || event.meta?.cwd || undefined,
      externalMeta: source === 'external' ? event.meta : undefined,
    };
    this._sessionMap.set(key, session);
    return session;
  }

  private _touchSession(event: IAgentHookEvent): void {
    const session = this._sessionMap.get(this._resolveKey(event));
    if (session) {
      session.lastEventAt = Date.now();
    }
  }

  /**
   * Resolve the **canonical key** for an incoming hook event. Uses
   * `agentSessionId` (agent-native) whenever present; otherwise falls back
   * through the alias table to the termlnk transport-layer `sessionId`.
   *
   * Whenever an event carries both ids, this method also:
   *   1. Registers `sessionId → agentSessionId` in the alias table so
   *      subsequent events that only carry `sessionId` (e.g. OpenCode
   *      `permission.ask`) route to the correct canonical entry.
   *   2. Performs a one-shot **identity upgrade**: if an existing session
   *      was stored under the transport-layer `sessionId` (because the first
   *      event arrived without an `agentSessionId`), migrate it to the
   *      canonical key.
   */
  private _resolveKey(event: IAgentHookEvent): string {
    if (event.agentSessionId) {
      const key = event.agentSessionId;
      if (event.sessionId && event.sessionId !== key) {
        this._aliasMap.set(event.sessionId, key);
        if (this._sessionMap.has(event.sessionId) && !this._sessionMap.has(key)) {
          this._mergeIntoCanonical(event.sessionId, key);
        }
      }
      return key;
    }
    return this._aliasMap.get(event.sessionId) ?? event.sessionId;
  }

  /** Resolve a canonical key from a plain id (public API input). */
  private _resolveKeyById(id: string): string {
    return this._aliasMap.get(id) ?? id;
  }

  private _mergeIntoCanonical(oldKey: string, newKey: string): void {
    const old = this._sessionMap.get(oldKey);
    if (!old) {
      return;
    }
    // `agentSessionId` is readonly — if the early entry was created before
    // the agent stamped its id, clone the record with the field backfilled.
    const migrated: IExternalAgentSession = old.agentSessionId
      ? old
      : { ...old, agentSessionId: newKey };
    this._sessionMap.set(newKey, migrated);
    this._sessionMap.delete(oldKey);
    const depth = this._subagentDepth.get(oldKey);
    if (depth !== undefined) {
      this._subagentDepth.set(newKey, depth);
      this._subagentDepth.delete(oldKey);
    }
  }

  /** Remove every alias whose value is the given canonical key. */
  private _purgeAliases(canonicalKey: string): void {
    for (const [alias, target] of this._aliasMap) {
      if (target === canonicalKey) {
        this._aliasMap.delete(alias);
      }
    }
  }

  /** Remove a session and its associated subagent depth tracking. */
  private _deleteSession(canonicalKey: string): boolean {
    this._subagentDepth.delete(canonicalKey);
    this._purgeAliases(canonicalKey);
    return this._sessionMap.delete(canonicalKey);
  }

  /** Called only on `user-prompt-submit`; `post-tool-use` and `stop` preserve the state. */
  private _resetLastToolState(session: IExternalAgentSession | undefined): void {
    if (!session) {
      return;
    }
    session.lastToolName = undefined;
    session.lastToolDescription = undefined;
    session.lastToolDetail = undefined;
  }

  private _emitSessions(): void {
    this._sessions$.next([...this._sessionMap.values()]);
  }
}
