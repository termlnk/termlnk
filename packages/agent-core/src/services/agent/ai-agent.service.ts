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

import type { AgentEvent, AgentTool } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, AssistantMessageEventStream, Model, UserMessage } from '@earendil-works/pi-ai';
import type { AgentStatus, IAgentToolPermissionRequest, IAIAgentService, IAIAgentState, IChatMessage, IChatUsage, ICompactConfig, ICompactMetadata, ICompactOptions, IImageAttachment, IImagePart, IMessagePart, ISendMessageOptions, IToolOutput, IToolPart, ThinkingLevel } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import type { IPendingDeliveryMode } from '../../common/pending-message-queue';
import { Agent } from '@earendil-works/pi-agent-core';
import { DEFAULT_COMPACT_CONFIG, DEFAULT_THINKING_LEVEL, IAgentToolPermissionService, ILLMProviderService, normalizeCompactConfig } from '@termlnk/agent';
import { Disposable, generateRandomId, ILogService, Inject } from '@termlnk/core';
import { ChatRepository } from '@termlnk/database';
import { BehaviorSubject, combineLatest, map, Subject } from 'rxjs';
import { PendingMessageQueue } from '../../common/pending-message-queue';
import { buildCompactUserPrompt, buildSummaryUserMessage, formatMessagesForCompaction, SUMMARIZATION_SYSTEM_PROMPT } from '../compact/compact-prompt';
import { getLatestContextTokens, shouldAutoCompact } from '../compact/compact-token';
import { invokeWithUserIntent } from '../permission/permission-guarded-tool';
import { appendErrorPart, appendTextDelta, appendThinkingDelta, finalizeToolPart, getErrorFromParts, getTextFromParts, getToolPartsFromParts, upsertToolPartInputDelta } from './message-parts';
import { buildFallbackModel } from '../llm-provider/utils';

const COMPACT_MAX_OUTPUT_TOKENS = 20000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;
// 502 excluded: usually a structural rejection (gateway forwarded an invalid
// request), not a transient failure — retrying the same body wastes time.
const RETRYABLE_ERROR_PATTERN = /overloaded|rate.?limit|too many requests|429|500|503|504|service.?unavailable|server error|internal error|connection.?error|connection.?refused|other side closed|fetch failed|upstream.?connect|reset before headers|terminated|retry delay/i;
const OVERFLOW_ERROR_PATTERN = /prompt.?too.?long|context.?length|max.?context|token.?limit|too many tokens|maximum context|exceeds.*context|input.*too.*large|request too large/i;

function buildUserMessageParts(content: string, images?: IImageAttachment[]): IMessagePart[] {
  const parts: IMessagePart[] = [];
  if (content) {
    parts.push({ type: 'text', text: content });
  }
  if (images && images.length > 0) {
    for (const img of images) {
      const imagePart: IImagePart = {
        type: 'image',
        data: img.data,
        mimeType: img.mimeType,
      };
      parts.push(imagePart);
    }
  }
  return parts;
}

function messageHasError(message: IChatMessage): boolean {
  return getErrorFromParts(message.parts) !== undefined;
}

function partsAsJsonValue(parts: IMessagePart[]): unknown[] {
  return parts as unknown[];
}

// Extract a renderable text representation from a tool's AgentToolResult.
// Walks every content item (not just content[0]) so multi-block results and
// image-leading payloads still produce something visible. Falls back to a
// JSON dump of the raw content when no text segments are present.
function extractToolResultText(result: unknown, isError: boolean): string {
  if (!result || typeof result !== 'object') {
    return isError ? 'Tool execution failed' : '';
  }
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return isError ? 'Tool execution failed' : '';
  }
  const segments: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.text === 'string' && obj.text.length > 0) {
      segments.push(obj.text);
    } else if (obj.type === 'image') {
      segments.push('[image]');
    }
  }
  if (segments.length > 0) {
    return segments.join('\n\n');
  }
  if (isError) {
    return 'Tool execution failed';
  }
  try {
    return JSON.stringify(content);
  } catch {
    return '';
  }
}

export class AIAgentService extends Disposable implements IAIAgentService {
  private _agent: Agent | null = null;
  private _model: Model<any> | null = null;
  private _systemPrompt: string = '';
  private _thinkingLevel: ThinkingLevel = DEFAULT_THINKING_LEVEL;
  private _tools: AgentTool<any>[] = [];
  private _apiKeys = new Map<string, string>();
  private _unsubscribeAgent: (() => void) | null = null;

  // Event processing queue — ensures serial processing to prevent race conditions
  private _eventQueue = Promise.resolve();

  // Abort coordination
  private _aborted = false;

  // Auto-retry state
  private _retryAttempt = 0;
  private _retryAbortController: AbortController | null = null;
  private _retryResolve: (() => void) | null = null;
  private _retryPromise: Promise<void> | null = null;

  // Tool execution result tracking — keyed by toolCallId, snapshots final outcome
  private _toolResults = new Map<string, { isError: boolean; output: IToolOutput }>();

  // Deferred finalization for messages with tool calls. pi-agent-core emits
  // message_end BEFORE tool_execution_end, so we must wait for all tool results
  // before finalizing the assistant message.
  private _deferredFinalization: {
    assistantMsg: AssistantMessage;
    usage: IChatUsage | undefined;
    toolCallIds: Set<string>;
  } | null = null;

  // Carried across abort() → _ensureAgent() to preserve conversation context
  private _savedAgentMessages: any[] = [];

  // Context overflow recovery: only attempt once per agent run to avoid loops
  private _overflowRecoveryAttempted = false;

  // Track the last assistant message for retry detection
  private _lastAssistantEvent: (AgentEvent & { type: 'message_end' }) | null = null;

  // Chat session tracking
  private readonly _currentSessionId$ = new BehaviorSubject<string | null>(null);
  readonly currentSessionId$: Observable<string | null> = this._currentSessionId$.asObservable();
  private _messageCounter = 0;

  // Compaction state
  private _compactConfig: ICompactConfig = { ...DEFAULT_COMPACT_CONFIG };
  private readonly _isCompacting$ = new BehaviorSubject<boolean>(false);
  readonly isCompacting$: Observable<boolean> = this._isCompacting$.asObservable();

  // Pending queue — messages enqueued via steer/followUp awaiting delivery to the LLM
  private readonly _pendingQueue = new PendingMessageQueue();
  readonly pendingMessageIds$: Observable<string[]> = this._pendingQueue.ids$;

  constructor(
    @ILLMProviderService private readonly _llmProviderService: ILLMProviderService,
    @Inject(ChatRepository) private readonly _chatRepository: ChatRepository,
    @IAgentToolPermissionService private readonly _permissionService: IAgentToolPermissionService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    // Reset local state when the active session is deleted elsewhere — avoids
    // stale FK references in subsequent _persistMessage calls.
    this.disposeWithMe(
      this._chatRepository.changed$.subscribe((event) => {
        if (event.type === 'delete' && event.sessionId === this._currentSessionId$.getValue()) {
          this._resetCurrentSessionState();
        }
      })
    );

    // Bridge IAgentToolPermissionRequest → IToolPart.state='awaiting-approval'
    // so the chat UI can render an inline approval card on the matching tool.
    this.disposeWithMe(
      this._permissionService.pendingRequests$.subscribe((requests) => {
        this._reflectPendingRequestsToCurrentMessage(requests);
      })
    );
  }

  private readonly _messages$ = new BehaviorSubject<IChatMessage[]>([]);
  readonly messages$: Observable<IChatMessage[]> = this._messages$.asObservable();

  private readonly _isStreaming$ = new BehaviorSubject<boolean>(false);
  readonly isStreaming$: Observable<boolean> = this._isStreaming$.asObservable();

  private readonly _status$ = new BehaviorSubject<AgentStatus>('idle');
  readonly status$: Observable<AgentStatus> = this._status$.asObservable();

  private readonly _currentMessage$ = new BehaviorSubject<IChatMessage | null>(null);
  readonly currentMessage$: Observable<IChatMessage | null> = this._currentMessage$.asObservable();

  private readonly _messageCompleted$ = new Subject<IChatMessage>();
  readonly messageCompleted$: Observable<IChatMessage> = this._messageCompleted$.asObservable();

  readonly state$: Observable<IAIAgentState> = combineLatest([
    this._messages$,
    this._status$,
    this._isStreaming$,
    this._currentMessage$,
    this._pendingQueue.ids$,
  ]).pipe(
    map(([messages, status, isStreaming, currentMessage, pendingMessageIds]) => ({
      messages,
      status,
      isStreaming,
      currentMessage,
      pendingMessageIds,
    }))
  );

  getCurrentSessionId(): string | null {
    return this._currentSessionId$.getValue();
  }

  async sendMessage(content: string, options?: ISendMessageOptions): Promise<void> {
    this.ensureNotDisposed();

    if (!this._currentSessionId$.getValue()) {
      await this.createNewSession();
    }

    const images = options?.images;
    const deliverAs = options?.deliverAs ?? 'auto';

    const userMessage: IChatMessage = {
      id: generateRandomId(),
      role: 'user',
      parts: buildUserMessageParts(content, images),
      createdAt: Date.now(),
    };
    this._appendMessage(userMessage);
    this._persistMessage(userMessage);

    // Run in progress: enqueue into pi-agent-core's steer/followUp queue to preserve current inference.
    // Gate on `agent.state.isStreaming` — pi-agent-core's canonical run flag, set true in
    // `runWithLifecycle` and cleared in `finishRun` (finally). Our own `_isStreaming$` flips
    // false between tool-call turns while the run is still active, so it would let the second
    // prompt fall through and throw "Agent is already processing a prompt."
    if (this._isAgentRunning()) {
      const mode: IPendingDeliveryMode = deliverAs === 'followUp' ? 'followUp' : 'steer';
      this._queueUserMessage(userMessage.id, content, images, mode);
      return;
    }

    if (!this._model) {
      const errorMessage: IChatMessage = {
        id: generateRandomId(),
        role: 'assistant',
        parts: appendErrorPart([], 'No model configured. Please select a model in the settings first.'),
        createdAt: Date.now(),
        isStreaming: false,
      };
      this._appendMessage(errorMessage);
      this._persistMessage(errorMessage);
      this._messageCompleted$.next(errorMessage);
      this._status$.next('error');
      return;
    }

    const agent = this._ensureAgent();
    this._aborted = false;
    this._isStreaming$.next(true);
    this._status$.next('thinking');

    try {
      const imageContents = images?.map((img) => ({
        type: 'image' as const,
        data: img.data,
        mimeType: img.mimeType,
      }));
      await agent.prompt(content, imageContents);
      if (this._agent !== agent) {
        return;
      }
      await this._waitForRetry();
    } catch (error: any) {
      if (this._agent !== agent) {
        return;
      }
      this._logService.error('[AIAgentService] prompt error:', error);
      this._finalizeWithError(error?.message ?? 'An unexpected error occurred.');
    }
  }

  async cancelPending(messageId: string): Promise<void> {
    this.ensureNotDisposed();

    if (!this._pendingQueue.remove(messageId)) {
      return;
    }

    const nextMessages = this._messages$.getValue().filter((m) => m.id !== messageId);
    this._messages$.next(nextMessages);

    const sessionId = this._currentSessionId$.getValue();
    if (sessionId) {
      try {
        await this._replaceSessionMessages(sessionId, nextMessages);
      } catch (err) {
        this._logService.error('[AIAgentService] cancelPending persist failed:', err);
      }
    }

    // pi-agent-core has no by-id removal — clear and rebuild from the surviving entries.
    this._rebuildAgentQueuesFromPending();
  }

  clearPendingQueue(): void {
    this._pendingQueue.clear();
    this._agent?.clearAllQueues();
  }

  async retryMessage(messageId: string): Promise<void> {
    this.ensureNotDisposed();

    if (this._isAgentRunning() || this._isStreaming$.getValue()) {
      this.abort();
    }

    const messages = this._messages$.getValue();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0 || messages[idx].role !== 'assistant') {
      return;
    }

    let userIdx = idx - 1;
    while (userIdx >= 0 && messages[userIdx].role !== 'user') {
      userIdx -= 1;
    }
    if (userIdx < 0) {
      return;
    }

    const userMsg = messages[userIdx];
    const userText = getTextFromParts(userMsg.parts);
    const userImages = userMsg.parts
      .filter((p): p is IImagePart => p.type === 'image')
      .map((p) => ({ data: p.data, mimeType: p.mimeType }));

    await this._truncateAndReset(messages.slice(0, userIdx));
    await this.sendMessage(userText, { images: userImages });
  }

  async editUserMessage(messageId: string, content: string): Promise<void> {
    this.ensureNotDisposed();

    if (this._isAgentRunning() || this._isStreaming$.getValue()) {
      this.abort();
    }

    const messages = this._messages$.getValue();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0 || messages[idx].role !== 'user') {
      return;
    }

    const userImages = messages[idx].parts
      .filter((p): p is IImagePart => p.type === 'image')
      .map((p) => ({ data: p.data, mimeType: p.mimeType }));

    await this._truncateAndReset(messages.slice(0, idx));
    await this.sendMessage(content, { images: userImages });
  }

  /**
   * Drop messages, persist the truncation, and reset every transient agent
   * structure so the next sendMessage() starts on a clean slate. Caller is
   * responsible for invoking sendMessage() afterwards.
   */
  private async _truncateAndReset(kept: IChatMessage[]): Promise<void> {
    this._messages$.next(kept);
    const sessionId = this._currentSessionId$.getValue();
    if (sessionId) {
      try {
        await this._replaceSessionMessages(sessionId, kept);
      } catch (err) {
        this._logService.error('[AIAgentService] Truncate persist failed:', err);
      }
    }
    this._cancelRetry();
    this._toolResults.clear();
    this._deferredFinalization = null;
    this._currentMessage$.next(null);
    this._destroyAgent();
    this._savedAgentMessages = [];
  }

  stopStreaming(): void {
    this.abort();
  }

  abort(): void {
    if (!this._agent) {
      return;
    }

    this._aborted = true;
    this._agent.abort();
    this._cancelRetry();

    // pi-agent-core does not release its processing lock synchronously on abort();
    // recreate the agent so the next prompt() starts on a clean slate. Clearing
    // _lastAssistantEvent suppresses stale retry triggers from any queued events
    // still dispatched by the destroyed instance.
    this._savedAgentMessages = [...this._agent.state.messages];
    this._lastAssistantEvent = null;
    this._deferredFinalization = null;
    this._destroyAgent();

    const current = this._currentMessage$.getValue();
    if (current) {
      const completed: IChatMessage = {
        ...current,
        isStreaming: false,
      };
      this._currentMessage$.next(null);
      this._appendMessage(completed);
      this._persistMessage(completed);
      this._messageCompleted$.next(completed);
    }

    this._pendingQueue.clear();
    this._isStreaming$.next(false);
    this._status$.next('idle');
    this._aborted = false;
  }

  clearMessages(): void {
    this._messages$.next([]);
    this._currentMessage$.next(null);
    this._isStreaming$.next(false);
    this._status$.next('idle');
    this._toolResults.clear();
    this._deferredFinalization = null;
    this._cancelRetry();
    this._pendingQueue.clear();
    this._messageCounter = 0;

    if (this._agent) {
      this._agent.reset();
    }

    this.createNewSession().catch(() => {});
  }

  reset(): void {
    this.clearMessages();
  }

  async loadSession(sessionId: string): Promise<void> {
    this.ensureNotDisposed();

    const session = await this._chatRepository.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Clear current state
    this._cancelRetry();
    this._toolResults.clear();
    this._deferredFinalization = null;
    this._pendingQueue.clear();
    this._isStreaming$.next(false);
    this._status$.next('idle');
    this._currentMessage$.next(null);

    if (this._agent) {
      this._agent.reset();
    }

    // Load messages from DB
    const dbMessages = await this._chatRepository.getMessages(sessionId);
    const messages: IChatMessage[] = dbMessages.map((m) => ({
      id: m.id,
      role: m.role as IChatMessage['role'],
      parts: (m.parts ?? []) as IMessagePart[],
      usage: m.usage as IChatUsage | undefined,
      compactMetadata: (m.compactMetadata as ICompactMetadata | null) ?? undefined,
      hiddenInUI: m.hiddenInUI ?? undefined,
      createdAt: new Date(m.createdAt).getTime(),
    }));

    this._messages$.next(messages);
    this._messageCounter = messages.length;
    this._currentSessionId$.next(sessionId);

    // Restore Agent state from the most recent compact-summary (if any)
    const lastHidden = messages.findLast((m) => m.hiddenInUI && m.role === 'user');
    if (lastHidden) {
      this._savedAgentMessages = [{
        role: 'user',
        content: getTextFromParts(lastHidden.parts),
        timestamp: new Date(lastHidden.createdAt).valueOf(),
      } satisfies UserMessage];
    } else {
      this._savedAgentMessages = [];
    }

    await this._chatRepository.updateSession(sessionId, {
      accessedAt: new Date().toISOString(),
    });
  }

  async createNewSession(): Promise<string> {
    this.ensureNotDisposed();

    const sessionId = generateRandomId();
    const now = new Date().toISOString();

    await this._chatRepository.createSession({
      id: sessionId,
      title: 'New Chat',
      accessedAt: now,
    });

    this._messages$.next([]);
    this._currentMessage$.next(null);
    this._isStreaming$.next(false);
    this._status$.next('idle');
    this._pendingQueue.clear();
    this._messageCounter = 0;
    this._currentSessionId$.next(sessionId);

    if (this._agent) {
      this._agent.reset();
    }

    return sessionId;
  }

  async restoreLastSession(): Promise<boolean> {
    this.ensureNotDisposed();

    if (this._currentSessionId$.getValue()) {
      return true;
    }

    const sessions = await this._chatRepository.listSessions();
    const last = sessions[0];
    if (!last) {
      return false;
    }

    await this.loadSession(last.id);
    return true;
  }

  setModel(provider: string, modelId: string): void {
    this.ensureNotDisposed();

    const resolved = this._llmProviderService.resolveModel(provider, modelId);
    const providerConfig = this._llmProviderService.getProviderConfig(provider);

    if (resolved) {
      this._model = resolved;
    } else {
      this._model = buildFallbackModel(provider, modelId, providerConfig ?? undefined);
    }

    if (providerConfig?.apiKey) {
      this._apiKeys.set(provider, providerConfig.apiKey);
    }

    if (this._agent) {
      this._agent.state.model = this._model;
    }
  }

  setSystemPrompt(prompt: string): void {
    this._systemPrompt = prompt;
    if (this._agent) {
      this._agent.state.systemPrompt = prompt;
    }
  }

  setThinkingLevel(level: ThinkingLevel): void {
    this._thinkingLevel = level;
    if (this._agent) {
      this._agent.state.thinkingLevel = level;
    }
  }

  setTools(tools: AgentTool<any>[]): void {
    this._tools = tools;
    if (this._agent) {
      this._agent.state.tools = tools;
    }
  }

  addTools(tools: AgentTool<any>[]): void {
    this._tools = [...this._tools, ...tools];
    if (this._agent) {
      this._agent.state.tools = this._tools;
    }
  }

  removeTools(toolNames: string[]): void {
    const nameSet = new Set(toolNames);
    this._tools = this._tools.filter((t) => !nameSet.has(t.name));
    if (this._agent) {
      this._agent.state.tools = this._tools;
    }
  }

  setApiKey(provider: string, apiKey: string): void {
    this._apiKeys.set(provider, apiKey);
  }

  async invokeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    this.ensureNotDisposed();

    const tool = this._tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`[AIAgentService] Tool not found: ${toolName}`);
    }
    // D1 — User-initiated invocations bypass the permission guard via the
    // raw-tool back-channel registered by wrapToolWithPermission.
    return invokeWithUserIntent(tool, generateRandomId(), args);
  }

  setCompactConfig(config: ICompactConfig): void {
    this._compactConfig = normalizeCompactConfig(config);
  }

  async compactConversation(options: ICompactOptions): Promise<void> {
    this.ensureNotDisposed();

    if (this._isCompacting$.getValue()) {
      return;
    }

    if (options.trigger === 'manual' && this._isAgentRunning()) {
      this.abort();
    }

    if (!this._model) {
      throw new Error('[AIAgentService] No model configured; cannot compact.');
    }

    const sessionId = this._currentSessionId$.getValue();
    if (!sessionId) {
      return;
    }

    const allMessages = this._messages$.getValue();
    const visibleMessages = allMessages.filter((m) => !m.hiddenInUI && m.role !== 'compact_boundary');
    const keepCount = this._compactConfig.keepRecentMessages;
    const toSummarize = visibleMessages.slice(0, Math.max(0, visibleMessages.length - keepCount));
    const toKeep = visibleMessages.slice(-keepCount);

    if (toSummarize.length === 0) {
      return;
    }

    // Extract previous summary for iterative compaction
    const lastBoundary = allMessages.findLast((m) => m.role === 'compact_boundary');
    const previousSummary = lastBoundary?.compactMetadata?.summary;

    this._isCompacting$.next(true);
    const previousStatus = this._status$.getValue();
    this._status$.next('compacting');

    try {
      const summary = await this._generateSummary(toSummarize, options.instructions, previousSummary);
      const preTokens = getLatestContextTokens(allMessages);

      const compactMetadata: ICompactMetadata = {
        trigger: options.trigger,
        preTokens,
        messagesSummarized: toSummarize.length,
        summary,
        userInstructions: options.instructions,
      };

      const boundaryMessage: IChatMessage = {
        id: generateRandomId(),
        role: 'compact_boundary',
        parts: [{ type: 'text', text: 'Conversation compacted' }],
        createdAt: Date.now(),
        compactMetadata,
      };

      const summaryUserContent = this._buildAgentSummaryContent(summary, toKeep, options.instructions);
      const summaryUserMessage: IChatMessage = {
        id: generateRandomId(),
        role: 'user',
        parts: [{ type: 'text', text: summaryUserContent }],
        createdAt: Date.now(),
        hiddenInUI: true,
      };

      // UI: boundary then recent messages (summary user message hidden)
      this._messages$.next([boundaryMessage, ...toKeep]);
      this._currentMessage$.next(null);

      // Agent state: single user message containing summary + recent transcript
      const agentUserMessage: UserMessage = {
        role: 'user',
        content: summaryUserContent,
        timestamp: Date.now(),
      };
      this._savedAgentMessages = [agentUserMessage];
      this._destroyAgent();

      // Persist replacement: [boundary, hidden-summary-user, ...toKeep]
      await this._replaceSessionMessages(sessionId, [boundaryMessage, summaryUserMessage, ...toKeep]);
    } catch (err) {
      this._logService.error('[AIAgentService] compactConversation failed:', err);
      throw err;
    } finally {
      this._isCompacting$.next(false);
      if (this._status$.getValue() === 'compacting') {
        this._status$.next(previousStatus === 'compacting' ? 'idle' : previousStatus);
      }
    }
  }

  override dispose(): void {
    this._cancelRetry();
    this._destroyAgent();
    this._pendingQueue.dispose();
    this._messages$.complete();
    this._isStreaming$.complete();
    this._status$.complete();
    this._currentMessage$.complete();
    this._messageCompleted$.complete();
    this._currentSessionId$.complete();
    this._isCompacting$.complete();
    super.dispose();
  }

  // Clears in-memory chat state; next sendMessage() lazily creates a new session.
  private _resetCurrentSessionState(): void {
    this._currentSessionId$.next(null);
    this._messages$.next([]);
    this._currentMessage$.next(null);
    this._messageCounter = 0;
    this._toolResults.clear();
    this._deferredFinalization = null;
    this._pendingQueue.clear();
    this._isStreaming$.next(false);
    this._status$.next('idle');
    this._cancelRetry();
    this._agent?.reset();
  }

  private _isForeignKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const e = error as { code?: string; message?: unknown };
    if (e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return true;
    }
    return typeof e.message === 'string' && /FOREIGN KEY constraint failed/i.test(e.message);
  }

  private async _persistMessage(message: IChatMessage): Promise<void> {
    const sessionId = this._currentSessionId$.getValue();
    if (!sessionId) {
      return;
    }

    try {
      await this._chatRepository.addMessage({
        id: message.id,
        sessionId,
        role: message.role,
        parts: partsAsJsonValue(message.parts),
        usage: message.usage ?? null,
        compactMetadata: message.compactMetadata ?? null,
        hiddenInUI: message.hiddenInUI ?? null,
        sortOrder: this._messageCounter++,
      });

      // Auto-generate session title after first assistant reply (user + assistant = 2 messages)
      if (message.role === 'assistant' && !messageHasError(message) && this._messages$.getValue().length === 2) {
        const messages = this._messages$.getValue();
        const userContent = getTextFromParts(messages[0]?.parts ?? []);
        const assistantContent = getTextFromParts(message.parts);
        this._generateSessionTitle(sessionId, userContent, assistantContent).catch((err) => {
          this._logService.error('[AIAgentService] Failed to generate session title:', err);
        });
      }
    } catch (error) {
      if (this._isForeignKeyError(error)) {
        this._logService.warn(`[AIAgentService] Session "${sessionId}" no longer exists; resetting local state.`);
        this._resetCurrentSessionState();
        return;
      }
      this._logService.error('[AIAgentService] Failed to persist message:', error);
    }
  }

  private async _generateSummary(
    messagesToSummarize: IChatMessage[],
    instructions?: string,
    previousSummary?: string
  ): Promise<string> {
    if (!this._model) {
      throw new Error('[AIAgentService] No model configured; cannot compact.');
    }

    const prompt = buildCompactUserPrompt(messagesToSummarize, instructions, previousSummary);

    const stream = this._llmProviderService.streamSimple(
      this._model,
      {
        systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
      },
      {
        maxTokens: COMPACT_MAX_OUTPUT_TOKENS,
        apiKey: this._apiKeys.get(this._model.provider),
      }
    );

    const summary = await this._consumeStreamAsText(stream);
    if (!summary) {
      throw new Error('[AIAgentService] Compaction produced an empty summary.');
    }
    return summary;
  }

  private _buildAgentSummaryContent(
    summary: string,
    toKeep: IChatMessage[],
    instructions?: string
  ): string {
    const summaryBlock = buildSummaryUserMessage(summary, instructions);
    if (toKeep.length === 0) {
      return summaryBlock;
    }
    const recentTranscript = formatMessagesForCompaction(toKeep);
    return `${summaryBlock}\n\n<recent-messages>\n${recentTranscript}\n</recent-messages>`;
  }

  private async _replaceSessionMessages(sessionId: string, messages: IChatMessage[]): Promise<void> {
    const inserts = messages.map((msg, index) => ({
      id: msg.id,
      sessionId,
      role: msg.role,
      parts: partsAsJsonValue(msg.parts),
      usage: msg.usage ?? null,
      compactMetadata: msg.compactMetadata ?? null,
      hiddenInUI: msg.hiddenInUI ?? null,
      sortOrder: index,
    }));

    await this._chatRepository.replaceSessionMessages(sessionId, inserts);
    this._messageCounter = inserts.length;
  }

  private _maybeAutoCompact(): void {
    if (this._isCompacting$.getValue()) {
      return;
    }
    if (!this._compactConfig.enabled) {
      return;
    }
    if (!this._model) {
      return;
    }
    const tokens = getLatestContextTokens(this._messages$.getValue());
    const contextWindow = this._model.contextWindow ?? 128000;
    if (!shouldAutoCompact(tokens, contextWindow, this._compactConfig)) {
      return;
    }
    queueMicrotask(() => {
      this.compactConversation({ trigger: 'auto' }).catch((err) => {
        this._logService.error('[AIAgentService] Auto compact failed:', err);
      });
    });
  }

  private _truncateTitle(text: string, maxLength = 50): string {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  private async _generateSessionTitle(sessionId: string, userContent: string, assistantContent: string): Promise<void> {
    if (!this._model) {
      await this._chatRepository.renameSession(sessionId, this._truncateTitle(userContent));
      return;
    }

    try {
      const prompt = `Generate a concise title (max 20 characters) for this conversation. Reply with ONLY the title, no quotes or extra text.\n\nUser: ${userContent.substring(0, 200)}\nAssistant: ${assistantContent.substring(0, 200)}`;

      const stream = this._llmProviderService.streamSimple(
        this._model,
        { messages: [{ role: 'user', content: prompt, timestamp: Date.now() }] },
        {
          maxTokens: 50,
          apiKey: this._apiKeys.get(this._model.provider),
        }
      );

      let title = await this._consumeStreamAsText(stream);
      title = title.replace(/^["']|["']$/g, '');
      if (!title) {
        title = this._truncateTitle(userContent);
      }

      await this._chatRepository.renameSession(sessionId, title);
    } catch (error) {
      this._logService.error('[AIAgentService] Title generation failed, using fallback:', error);
      await this._chatRepository.renameSession(sessionId, this._truncateTitle(userContent));
    }
  }

  private _appendMessage(message: IChatMessage): void {
    const current = this._messages$.getValue();
    this._messages$.next([...current, message]);
  }

  private _buildAgentUserMessage(content: string, images?: IImageAttachment[]): UserMessage {
    if (!images || images.length === 0) {
      return { role: 'user', content, timestamp: Date.now() };
    }
    const parts: UserMessage['content'] = [{ type: 'text', text: content }];
    for (const img of images) {
      parts.push({ type: 'image', data: img.data, mimeType: img.mimeType });
    }
    return { role: 'user', content: parts, timestamp: Date.now() };
  }

  /**
   * True iff pi-agent-core has an active run in flight. Reads
   * `agent.state.isStreaming` — the canonical run flag set in `runWithLifecycle`
   * and cleared in `finishRun` (finally block). Unlike our own `_isStreaming$`,
   * it stays true across tool-call turns for the full run lifecycle.
   */
  private _isAgentRunning(): boolean {
    return this._agent?.state.isStreaming === true;
  }

  /**
   * Bookkeep a user message and dispatch it to pi-agent-core's steer/followUp
   * queue. Assumes an agent instance exists (caller has checked `_isAgentRunning`).
   */
  private _queueUserMessage(id: string, content: string, images: IImageAttachment[] | undefined, mode: IPendingDeliveryMode): void {
    const agent = this._agent;
    if (!agent) {
      return;
    }
    this._pendingQueue.enqueue(id, { content, images, mode });
    this._dispatchToAgentQueue(agent, mode, this._buildAgentUserMessage(content, images));
  }

  /**
   * pi-agent-core has no by-id removal from its steer/followUp queues. After
   * we cancel a pending entry from our bookkeeping, drop everything in the
   * agent queues and replay the surviving entries in original insertion order.
   */
  private _rebuildAgentQueuesFromPending(): void {
    const agent = this._agent;
    if (!agent) {
      return;
    }
    agent.clearSteeringQueue();
    agent.clearFollowUpQueue();
    for (const entry of this._pendingQueue.values()) {
      this._dispatchToAgentQueue(agent, entry.mode, this._buildAgentUserMessage(entry.content, entry.images));
    }
  }

  private _dispatchToAgentQueue(agent: Agent, mode: IPendingDeliveryMode, message: UserMessage): void {
    if (mode === 'steer') {
      agent.steer(message);
    } else {
      agent.followUp(message);
    }
  }

  private _extractUserMessageText(message: { content: UserMessage['content'] }): string {
    if (typeof message.content === 'string') {
      return message.content;
    }
    for (const part of message.content) {
      if (part.type === 'text') {
        return part.text;
      }
    }
    return '';
  }

  private _ensureAgent(): Agent {
    if (this._agent) {
      return this._agent;
    }

    if (!this._model) {
      throw new Error('[AIAgentService]: No model configured.');
    }

    this._agent = new Agent({
      initialState: {
        systemPrompt: this._systemPrompt,
        model: this._model,
        thinkingLevel: this._thinkingLevel,
        tools: this._tools,
        messages: this._savedAgentMessages,
      },
      streamFn: (model, context, options) => this._llmProviderService.streamSimple(model, context, options),
      getApiKey: async (provider: string) => {
        return this._apiKeys.get(provider);
      },
    });
    this._savedAgentMessages = [];

    this._unsubscribeAgent = this._agent.subscribe(async (event: AgentEvent, _signal: AbortSignal) => {
      this._handleAgentEvent(event);
    });

    return this._agent;
  }

  private _destroyAgent(): void {
    if (this._unsubscribeAgent) {
      this._unsubscribeAgent();
      this._unsubscribeAgent = null;
    }
    this._agent = null;
  }

  private _handleAgentEvent(event: AgentEvent): void {
    this._eventQueue = this._eventQueue.then(
      () => this._processAgentEvent(event),
      () => this._processAgentEvent(event)
    );
    this._eventQueue.catch(() => {});
  }

  private _processAgentEvent(event: AgentEvent): void {
    // Skip events after abort (except agent_end for cleanup)
    if (this._aborted && event.type !== 'agent_end') {
      return;
    }

    if (event.type === 'message_start' && 'role' in event.message && event.message.role === 'user') {
      this._pendingQueue.removeMatchingContent(this._extractUserMessageText(event.message));
    }

    switch (event.type) {
      case 'message_start': {
        this._handleMessageStart(event);
        break;
      }
      case 'message_update': {
        this._handleMessageUpdate(event);
        break;
      }
      case 'message_end': {
        this._handleMessageEnd(event);
        break;
      }
      case 'tool_execution_start': {
        this._status$.next('tool_calling');
        break;
      }
      case 'tool_execution_end': {
        this._handleToolExecutionEnd(event);
        break;
      }
      case 'agent_end': {
        this._handleAgentEnd(event);
        break;
      }
    }
  }

  private _handleMessageStart(event: AgentEvent & { type: 'message_start' }): void {
    const agentMessage = event.message;

    // Only create streaming placeholder for assistant messages
    if (!('role' in agentMessage) || agentMessage.role !== 'assistant') {
      return;
    }

    // Create streaming message (single point of creation)
    const current = this._currentMessage$.getValue();
    if (!current) {
      const streamingMessage: IChatMessage = {
        id: generateRandomId(),
        role: 'assistant',
        parts: [],
        createdAt: Date.now(),
        isStreaming: true,
      };
      this._currentMessage$.next(streamingMessage);
      this._isStreaming$.next(true);
      this._status$.next('thinking');
    }
  }

  private _handleMessageUpdate(event: AgentEvent & { type: 'message_update' }): void {
    const assistantEvent = event.assistantMessageEvent;
    const current = this._currentMessage$.getValue();
    if (!current) {
      return;
    }

    let nextParts = current.parts;

    switch (assistantEvent.type) {
      case 'text_delta': {
        this._status$.next('streaming');
        nextParts = appendTextDelta(nextParts, assistantEvent.delta);
        break;
      }
      case 'thinking_delta': {
        this._status$.next('thinking');
        nextParts = appendThinkingDelta(nextParts, assistantEvent.delta);
        break;
      }
      case 'toolcall_delta': {
        this._status$.next('tool_calling');
        const partialContent = assistantEvent.partial.content[assistantEvent.contentIndex];
        if (partialContent?.type === 'toolCall') {
          const toolCallId = partialContent.id;
          const toolName = partialContent.name ?? 'unknown';
          if (toolCallId) {
            nextParts = upsertToolPartInputDelta(nextParts, toolCallId, toolName, assistantEvent.delta);
          }
        }
        break;
      }
      case 'error': {
        this._status$.next('error');
        this._isStreaming$.next(false);
        const errorMessage = assistantEvent.error?.errorMessage ?? 'Unknown error';
        const errorParts = appendErrorPart(current.parts, errorMessage);
        const errorMsg: IChatMessage = {
          ...current,
          parts: errorParts,
          isStreaming: false,
        };
        this._currentMessage$.next(null);
        this._appendMessage(errorMsg);
        this._persistMessage(errorMsg);
        this._messageCompleted$.next(errorMsg);
        return;
      }
    }

    if (nextParts !== current.parts) {
      this._currentMessage$.next({ ...current, parts: nextParts });
    }
  }

  private _handleMessageEnd(event: AgentEvent & { type: 'message_end' }): void {
    const agentMessage = event.message;

    // Ignore non-assistant message_end events
    if (!('role' in agentMessage) || agentMessage.role !== 'assistant') {
      return;
    }

    // Track for retry detection in agent_end
    this._lastAssistantEvent = event;

    const current = this._currentMessage$.getValue();
    if (!current) {
      return;
    }

    const assistantMsg = agentMessage as AssistantMessage;

    const usage: IChatUsage | undefined = assistantMsg.usage
      ? {
        promptTokens: assistantMsg.usage.input ?? 0,
        completionTokens: assistantMsg.usage.output ?? 0,
        totalTokens: assistantMsg.usage.totalTokens ?? 0,
      }
      : undefined;

    // pi-agent-core emits message_end BEFORE tool_execution_end. If this
    // message contains tool calls whose results have not yet arrived, defer
    // finalization so _handleToolExecutionEnd can fill them in first.
    const pendingToolCallIds = new Set<string>();
    for (const block of assistantMsg.content) {
      if (block.type === 'toolCall' && !this._toolResults.has(block.id)) {
        pendingToolCallIds.add(block.id);
      }
    }

    if (pendingToolCallIds.size > 0) {
      this._deferredFinalization = { assistantMsg, usage, toolCallIds: pendingToolCallIds };

      // Rebuild parts from canonical content so inputs are finalized, but keep
      // the message as streaming so tool_execution_end can update it in-place.
      const rebuiltParts = this._rebuildPartsFromAssistant(assistantMsg, current.parts);
      this._currentMessage$.next({ ...current, parts: rebuiltParts });
      return;
    }

    // No pending tool calls — finalize immediately.
    this._finalizeAssistantMessage(current, assistantMsg, usage);
  }

  /**
   * Finalize a deferred assistant message after the last pending tool result
   * arrives. Called from _handleToolExecutionEnd.
   */
  private _finalizeDeferredMessage(): void {
    const deferred = this._deferredFinalization;
    if (!deferred) {
      return;
    }
    this._deferredFinalization = null;

    const current = this._currentMessage$.getValue();
    if (!current) {
      return;
    }

    this._finalizeAssistantMessage(current, deferred.assistantMsg, deferred.usage);
  }

  /**
   * Shared finalization: rebuild parts, persist, emit, clean up.
   */
  private _finalizeAssistantMessage(
    current: IChatMessage,
    assistantMsg: AssistantMessage,
    usage: IChatUsage | undefined
  ): void {
    // Rebuild parts from final assistant.content blocks (canonical source).
    // For tool calls we prefer the result we just tracked, but fall back to
    // any output already attached to the live streaming part — that path
    // catches results that flowed through finalizeToolPart but never made it
    // into _toolResults (or were lost across rebuild boundaries).
    const finalParts = this._rebuildPartsFromAssistant(assistantMsg, current.parts);

    // If final content is empty (e.g. abort), keep streaming parts but finalize tool states
    let parts = finalParts.length > 0 ? finalParts : current.parts;
    if (finalParts.length === 0) {
      for (const tool of getToolPartsFromParts(parts)) {
        const tracked = this._toolResults.get(tool.toolCallId);
        if (tracked) {
          parts = finalizeToolPart(parts, tool.toolCallId, {
            state: tracked.isError ? 'output-error' : 'output-available',
            output: tracked.output,
            finalInput: tool.input,
          });
        }
      }
    }

    // Propagate API errors to the message as an error part
    if (assistantMsg.stopReason === 'error' && assistantMsg.errorMessage) {
      parts = appendErrorPart(parts, assistantMsg.errorMessage);
    }

    const completedMessage: IChatMessage = {
      id: current.id,
      role: 'assistant',
      parts,
      createdAt: current.createdAt,
      usage,
      isStreaming: false,
    };

    this._currentMessage$.next(null);
    this._appendMessage(completedMessage);
    this._persistMessage(completedMessage);
    this._messageCompleted$.next(completedMessage);
    this._isStreaming$.next(false);
    this._status$.next(messageHasError(completedMessage) ? 'error' : 'idle');

    // Clear tool results for this turn
    this._toolResults.clear();

    // Evaluate auto-compaction after assistant message finalizes
    if (!messageHasError(completedMessage)) {
      this._maybeAutoCompact();
    }
  }

  /**
   * Rebuild IMessagePart[] from the canonical AssistantMessage.content blocks,
   * attaching any available tool results from _toolResults or existing streaming parts.
   */
  private _rebuildPartsFromAssistant(
    assistantMsg: AssistantMessage,
    existingParts: IMessagePart[]
  ): IMessagePart[] {
    const result: IMessagePart[] = [];
    const existingToolParts = new Map<string, IToolPart>();
    for (const p of existingParts) {
      if (p.type === 'tool') {
        existingToolParts.set(p.toolCallId, p);
      }
    }
    for (const block of assistantMsg.content) {
      if (block.type === 'text') {
        result.push({ type: 'text', text: block.text });
      } else if (block.type === 'thinking') {
        result.push({ type: 'thinking', thinking: block.thinking });
      } else if (block.type === 'toolCall') {
        const tracked = this._toolResults.get(block.id);
        const existing = existingToolParts.get(block.id);
        const output = tracked?.output ?? existing?.output;
        const isError = tracked?.isError
          ?? (existing?.state === 'output-error' || existing?.output?.isError === true);
        const toolPart: IToolPart = {
          type: 'tool',
          toolCallId: block.id,
          toolName: block.name,
          state: output
            ? (isError ? 'output-error' : 'output-available')
            : 'input-available',
          input: block.arguments ?? {},
          output,
        };
        result.push(toolPart);
      }
    }
    return result;
  }

  /**
   * Reflects the pending-permission queue onto the streaming message so each
   * IToolPart whose toolCallId matches a pending request flips to
   * 'awaiting-approval'. When the request resolves (no longer in the queue) the
   * part returns to 'input-available' so the existing tool_execution_end path
   * can take over and produce the final state.
   */
  private _reflectPendingRequestsToCurrentMessage(requests: IAgentToolPermissionRequest[]): void {
    const current = this._currentMessage$.getValue();
    if (!current) {
      return;
    }
    const reqByCallId = new Map<string, IAgentToolPermissionRequest>();
    for (const r of requests) {
      reqByCallId.set(r.toolCallId, r);
    }

    let changed = false;
    const nextParts = current.parts.map((p) => {
      if (p.type !== 'tool') {
        return p;
      }
      const req = reqByCallId.get(p.toolCallId);
      if (req) {
        if (p.state === 'awaiting-approval' && p.permissionRequest?.id === req.id) {
          return p;
        }
        changed = true;
        return { ...p, state: 'awaiting-approval' as const, permissionRequest: req };
      }
      if (p.state === 'awaiting-approval') {
        changed = true;
        const { permissionRequest: _drop, ...rest } = p;
        return { ...rest, state: 'input-available' as const };
      }
      return p;
    });

    if (changed) {
      this._currentMessage$.next({ ...current, parts: nextParts });
    }
  }

  private _handleToolExecutionEnd(event: AgentEvent & { type: 'tool_execution_end' }): void {
    const isError = !!event.isError;
    const resultText = extractToolResultText(event.result, isError);
    const output: IToolOutput = {
      text: resultText || undefined,
      isError: isError || undefined,
    };

    this._toolResults.set(event.toolCallId, { isError, output });

    // Live-update the streaming message so UI reflects the tool result immediately.
    // If no matching IToolPart exists yet (e.g. tool fired before any toolcall_delta),
    // skip — _finalizeDeferredMessage will rebuild parts from the canonical content.
    const current = this._currentMessage$.getValue();
    if (current) {
      const nextParts = finalizeToolPart(current.parts, event.toolCallId, {
        state: isError ? 'output-error' : 'output-available',
        output,
      });
      if (nextParts !== current.parts) {
        this._currentMessage$.next({ ...current, parts: nextParts });
      }
    }

    // Check if this was the last pending tool call for a deferred message.
    if (this._deferredFinalization) {
      this._deferredFinalization.toolCallIds.delete(event.toolCallId);
      if (this._deferredFinalization.toolCallIds.size === 0) {
        this._finalizeDeferredMessage();
      }
    }
  }

  private _handleAgentEnd(_event: AgentEvent & { type: 'agent_end' }): void {
    const lastAssistant = this._lastAssistantEvent?.message as AssistantMessage | undefined;
    const apiError = lastAssistant?.stopReason === 'error' ? lastAssistant.errorMessage : undefined;

    this._deferredFinalization = null;

    // Safety: if streaming is still active when agent ends, force cleanup
    const current = this._currentMessage$.getValue();
    if (current) {
      const parts = apiError ? appendErrorPart(current.parts, apiError) : current.parts;
      const completed: IChatMessage = {
        ...current,
        parts,
        isStreaming: false,
      };
      this._currentMessage$.next(null);
      this._appendMessage(completed);
      this._persistMessage(completed);
      this._messageCompleted$.next(completed);

      if (apiError) {
        this._status$.next('error');
      }
    }

    this._isStreaming$.next(false);

    // Context overflow recovery: auto-compact and retry (once per run)
    if (lastAssistant && !this._aborted && this._isContextOverflowError(lastAssistant)) {
      this._recoverFromOverflow();
      this._lastAssistantEvent = null;
      return;
    }

    if (lastAssistant && !this._aborted && this._isRetryableError(lastAssistant)) {
      this._attemptRetry();
      this._lastAssistantEvent = null;
      return;
    }

    this._retryAttempt = 0;
    this._resolveRetryPromise();
    this._lastAssistantEvent = null;
    this._aborted = false;
    this._overflowRecoveryAttempted = false;

    if (this._status$.getValue() !== 'error') {
      this._status$.next('idle');
    }
  }

  private _isRetryableError(message: AssistantMessage): boolean {
    if (message.stopReason !== 'error' || !message.errorMessage) {
      return false;
    }
    return RETRYABLE_ERROR_PATTERN.test(message.errorMessage);
  }

  private _attemptRetry(): void {
    this._retryAttempt++;

    if (this._retryAttempt > MAX_RETRY_ATTEMPTS) {
      this._logService.warn(`[AIAgentService] Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded.`);
      this._retryAttempt = 0;
      this._resolveRetryPromise();
      this._status$.next('error');
      return;
    }

    const delayMs = RETRY_BASE_DELAY_MS * (2 ** (this._retryAttempt - 1));
    this._logService.warn(`[AIAgentService] Retryable error detected, attempt ${this._retryAttempt}/${MAX_RETRY_ATTEMPTS}, waiting ${delayMs}ms...`);

    if (this._agent) {
      const messages = this._agent.state.messages;
      if (messages.length > 0 && 'role' in messages.at(-1)! && (messages.at(-1) as any).role === 'assistant') {
        this._agent.state.messages = messages.slice(0, -1);
      }
    }

    // Also remove the error message from our messages list
    const currentMessages = this._messages$.getValue();
    if (currentMessages.length > 0) {
      const lastMsg = currentMessages.at(-1);
      if (lastMsg && lastMsg.role === 'assistant' && messageHasError(lastMsg)) {
        this._messages$.next(currentMessages.slice(0, -1));
      }
    }

    this._status$.next('thinking');
    this._isStreaming$.next(true);

    this._ensureRetryPromise();

    // Wait with exponential backoff then retry
    this._retryAbortController = new AbortController();
    const signal = this._retryAbortController.signal;

    this._sleep(delayMs, signal).then(() => {
      this._retryAbortController = null;
      if (signal.aborted || !this._agent) {
        return;
      }

      this._agent.continue().catch((err: any) => {
        this._logService.error('[AIAgentService] Retry continue() failed:', err);
        this._retryAttempt = 0;
        this._resolveRetryPromise();
        this._finalizeWithError(err?.message ?? 'Retry failed.');
      });
    }).catch(() => {
      // Aborted during sleep — retry was cancelled
      this._retryAbortController = null;
    });
  }

  private _ensureRetryPromise(): void {
    if (!this._retryPromise) {
      this._retryPromise = new Promise<void>((resolve) => {
        this._retryResolve = resolve;
      });
    }
  }

  private _resolveRetryPromise(): void {
    if (this._retryResolve) {
      this._retryResolve();
      this._retryResolve = null;
      this._retryPromise = null;
    }
  }

  private _cancelRetry(): void {
    if (this._retryAbortController) {
      this._retryAbortController.abort();
      this._retryAbortController = null;
    }
    this._retryAttempt = 0;
    this._resolveRetryPromise();
  }

  private async _waitForRetry(): Promise<void> {
    if (this._retryPromise) {
      await this._retryPromise;
    }
  }

  private _sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Aborted'));
        return;
      }
      let timer: ReturnType<typeof setTimeout>;
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      };
      timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private _finalizeWithError(errorText: string): void {
    const current = this._currentMessage$.getValue();
    const parts = appendErrorPart(current?.parts ?? [], errorText);
    const errorMessage: IChatMessage = {
      id: current?.id ?? generateRandomId(),
      role: 'assistant',
      parts,
      createdAt: current?.createdAt ?? Date.now(),
      isStreaming: false,
    };
    this._currentMessage$.next(null);
    this._appendMessage(errorMessage);
    this._persistMessage(errorMessage);
    this._messageCompleted$.next(errorMessage);
    this._isStreaming$.next(false);
    this._status$.next('error');
  }

  private _isContextOverflowError(message: AssistantMessage): boolean {
    if (message.stopReason !== 'error' || !message.errorMessage) {
      return false;
    }
    return OVERFLOW_ERROR_PATTERN.test(message.errorMessage);
  }

  private _recoverFromOverflow(): void {
    if (this._overflowRecoveryAttempted) {
      this._logService.warn('[AIAgentService] Overflow recovery already attempted; skipping to avoid loop.');
      this._resolveRetryPromise();
      return;
    }
    this._overflowRecoveryAttempted = true;

    this._logService.warn('[AIAgentService] Context overflow detected, attempting auto-compact recovery...');

    const currentMessages = this._messages$.getValue();
    if (currentMessages.length > 0) {
      const lastMsg = currentMessages.at(-1);
      if (lastMsg && lastMsg.role === 'assistant' && messageHasError(lastMsg)) {
        this._messages$.next(currentMessages.slice(0, -1));
      }
    }

    this._ensureRetryPromise();

    this.compactConversation({ trigger: 'auto' })
      .then(() => {
        if (this._aborted) {
          this._resolveRetryPromise();
          return;
        }
        const agent = this._ensureAgent();
        this._isStreaming$.next(true);
        this._status$.next('thinking');
        agent.continue().catch((err: any) => {
          this._logService.error('[AIAgentService] Overflow recovery retry failed:', err);
          this._resolveRetryPromise();
          this._finalizeWithError(err?.message ?? 'Overflow recovery retry failed.');
        });
      })
      .catch((err) => {
        this._logService.error('[AIAgentService] Overflow recovery compact failed:', err);
        this._resolveRetryPromise();
        this._finalizeWithError(err?.message ?? 'Context overflow recovery failed.');
      });
  }

  private async _consumeStreamAsText(stream: AssistantMessageEventStream): Promise<string> {
    let text = '';
    for await (const event of stream) {
      if (event.type === 'text_delta') {
        text += event.delta;
      } else if (event.type === 'error') {
        const errorMessage = event.error?.errorMessage ?? 'Stream failed';
        throw new Error(errorMessage);
      }
    }
    return text.trim();
  }
}
