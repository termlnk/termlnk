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

import type { AgentEvent, AgentTool } from '@mariozechner/pi-agent-core';
import type { Api, AssistantMessage, Model, UserMessage } from '@mariozechner/pi-ai';
import type { AgentStatus, IAIAgentService, IAIAgentState, IChatMessage, IChatToolCall, IChatUsage, ICompactConfig, ICompactMetadata, ICompactOptions, IImageAttachment, ISendMessageOptions, ThinkingLevel } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import type { IPendingDeliveryMode } from '../../common/pending-message-queue';
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel, streamSimple } from '@mariozechner/pi-ai';
import { DEFAULT_COMPACT_CONFIG, DEFAULT_THINKING_LEVEL, ILLMProviderService, normalizeCompactConfig } from '@termlnk/agent';
import { Disposable, generateRandomId, Inject } from '@termlnk/core';
import { ChatRepository } from '@termlnk/database';
import { BehaviorSubject, combineLatest, map, Subject } from 'rxjs';
import { PendingMessageQueue } from '../../common/pending-message-queue';
import { buildCompactUserPrompt, buildSummaryUserMessage, formatMessagesForCompaction } from '../compact/compact-prompt';
import { getLatestPromptTokens, shouldAutoCompact } from '../compact/compact-token';

const COMPACT_MAX_OUTPUT_TOKENS = 20000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;
const RETRYABLE_ERROR_PATTERN = /overloaded|rate.?limit|too many requests|429|500|502|503|504|service.?unavailable|server error|internal error|connection.?error|connection.?refused|other side closed|fetch failed|upstream.?connect|reset before headers|terminated|retry delay/i;

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

  // Tool execution result tracking
  private _toolResults = new Map<string, { status: 'success' | 'error'; error?: string }>();

  // Carried across abort() → _ensureAgent() to preserve conversation context
  private _savedAgentMessages: any[] = [];

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
    @Inject(ILLMProviderService) private readonly _llmProviderService: ILLMProviderService,
    @Inject(ChatRepository) private readonly _chatRepository: ChatRepository
  ) {
    super();
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
      content,
      images,
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
        content: '',
        error: 'No model configured. Please select a model in the settings first.',
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
      console.error('[AIAgentService] prompt error:', error);
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
        console.error('[AIAgentService] cancelPending persist failed:', err);
      }
    }

    // pi-agent-core has no by-id removal — clear and rebuild from the surviving entries.
    this._rebuildAgentQueuesFromPending();
  }

  clearPendingQueue(): void {
    this._pendingQueue.clear();
    this._agent?.clearAllQueues();
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
      content: m.content,
      thinking: m.thinking ?? undefined,
      toolCalls: m.toolCalls as IChatToolCall[] | undefined,
      error: m.error ?? undefined,
      usage: m.usage as IChatUsage | undefined,
      compactMetadata: (m.compactMetadata as ICompactMetadata | null) ?? undefined,
      hiddenInUI: m.hiddenInUI ?? undefined,
      createdAt: new Date(m.createdAt).getTime(),
    }));

    this._messages$.next(messages);
    this._messageCounter = messages.length;
    this._currentSessionId$.next(sessionId);

    // Restore Agent state from the most recent compact-summary (if any)
    const lastHidden = [...messages].reverse().find((m) => m.hiddenInUI && m.role === 'user');
    if (lastHidden) {
      this._savedAgentMessages = [{
        role: 'user',
        content: lastHidden.content,
        timestamp: new Date(lastHidden.createdAt).valueOf(),
      } satisfies UserMessage];
    } else {
      this._savedAgentMessages = [];
    }

    // Update accessed time
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

  setModel(provider: string, modelId: string): void {
    this.ensureNotDisposed();

    // First try to resolve from LLMProviderService (includes overrides)
    const resolved = this._llmProviderService.resolveModel(provider, modelId);
    if (resolved) {
      this._model = resolved;
    } else {
      // Fallback to pi-ai direct lookup
      try {
        this._model = getModel(provider as any, modelId as any);
      } catch {
        // Last resort: construct a fallback model with provider config
        const providerConfig = this._llmProviderService.getProviderConfig(provider);
        this._model = {
          id: modelId,
          name: modelId,
          api: (providerConfig?.api ?? 'openai-completions') as Api,
          provider,
          baseUrl: providerConfig?.baseUrl ?? '',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128000,
          maxTokens: 16384,
          headers: providerConfig?.headers,
        } as Model<any>;
      }
    }

    // Sync API key from provider config
    const providerConfig = this._llmProviderService.getProviderConfig(provider);
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

    this._isCompacting$.next(true);
    const previousStatus = this._status$.getValue();
    this._status$.next('compacting');

    try {
      const summary = await this._generateSummary(toSummarize, options.instructions);
      const preTokens = getLatestPromptTokens(allMessages);

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
        content: 'Conversation compacted',
        createdAt: Date.now(),
        compactMetadata,
      };

      const summaryUserMessage: IChatMessage = {
        id: generateRandomId(),
        role: 'user',
        content: this._buildAgentSummaryContent(summary, toKeep, options.instructions),
        createdAt: Date.now(),
        hiddenInUI: true,
      };

      // UI: boundary then recent messages (summary user message hidden)
      this._messages$.next([boundaryMessage, ...toKeep]);
      this._currentMessage$.next(null);

      // Agent state: single user message containing summary + recent transcript
      const agentUserMessage: UserMessage = {
        role: 'user',
        content: summaryUserMessage.content,
        timestamp: Date.now(),
      };
      this._savedAgentMessages = [agentUserMessage];
      this._destroyAgent();

      // Persist replacement: [boundary, hidden-summary-user, ...toKeep]
      await this._replaceSessionMessages(sessionId, [boundaryMessage, summaryUserMessage, ...toKeep]);
    } catch (err) {
      console.error('[AIAgentService] compactConversation failed:', err);
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
        content: message.content,
        thinking: message.thinking ?? null,
        toolCalls: message.toolCalls ?? null,
        error: message.error ?? null,
        usage: message.usage ?? null,
        compactMetadata: message.compactMetadata ?? null,
        hiddenInUI: message.hiddenInUI ?? null,
        sortOrder: this._messageCounter++,
      });

      // Auto-generate session title after first assistant reply (user + assistant = 2 messages)
      if (message.role === 'assistant' && !message.error && this._messages$.getValue().length === 2) {
        const messages = this._messages$.getValue();
        const userContent = messages[0]?.content ?? '';
        const assistantContent = message.content;
        this._generateSessionTitle(sessionId, userContent, assistantContent).catch((err) => {
          console.error('[AIAgentService] Failed to generate session title:', err);
        });
      }
    } catch (error) {
      console.error('[AIAgentService] Failed to persist message:', error);
    }
  }

  private async _generateSummary(
    messagesToSummarize: IChatMessage[],
    instructions?: string
  ): Promise<string> {
    if (!this._model) {
      throw new Error('[AIAgentService] No model configured; cannot compact.');
    }

    const prompt = buildCompactUserPrompt(messagesToSummarize, instructions);
    let summary = '';

    const stream = streamSimple(
      this._model,
      { messages: [{ role: 'user', content: prompt, timestamp: Date.now() }] },
      {
        maxTokens: COMPACT_MAX_OUTPUT_TOKENS,
        apiKey: this._apiKeys.get(this._model.provider),
      }
    );

    for await (const event of stream) {
      if (event.type === 'text_delta') {
        summary += event.delta;
      } else if (event.type === 'error') {
        const errorMessage = (event as any).error?.errorMessage ?? 'Compaction stream failed';
        throw new Error(errorMessage);
      }
    }

    const trimmed = summary.trim();
    if (!trimmed) {
      throw new Error('[AIAgentService] Compaction produced an empty summary.');
    }
    return trimmed;
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
      content: msg.content,
      thinking: msg.thinking ?? null,
      toolCalls: msg.toolCalls ?? null,
      error: msg.error ?? null,
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
    const tokens = getLatestPromptTokens(this._messages$.getValue());
    const contextWindow = this._model.contextWindow ?? 128000;
    if (!shouldAutoCompact(tokens, contextWindow, this._compactConfig)) {
      return;
    }
    queueMicrotask(() => {
      this.compactConversation({ trigger: 'auto' }).catch((err) => {
        console.error('[AIAgentService] Auto compact failed:', err);
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

      let title = '';
      const stream = streamSimple(
        this._model,
        { messages: [{ role: 'user', content: prompt, timestamp: Date.now() }] },
        {
          maxTokens: 50,
          apiKey: this._apiKeys.get(this._model.provider),
        }
      );

      for await (const event of stream) {
        if (event.type === 'text_delta') {
          title += event.delta;
        }
      }

      title = title.trim().replace(/^["']|["']$/g, '');
      if (!title) {
        title = this._truncateTitle(userContent);
      }

      await this._chatRepository.renameSession(sessionId, title);
    } catch (error) {
      console.error('[AIAgentService] Title generation failed, using fallback:', error);
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
      streamFn: streamSimple,
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
        content: '',
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

    let updatedContent = current.content;
    let updatedThinking = current.thinking;
    let updatedToolCalls = current.toolCalls ? [...current.toolCalls] : undefined;

    switch (assistantEvent.type) {
      case 'text_delta': {
        this._status$.next('streaming');
        updatedContent += assistantEvent.delta;
        break;
      }
      case 'thinking_delta': {
        this._status$.next('thinking');
        updatedThinking = (updatedThinking ?? '') + assistantEvent.delta;
        break;
      }
      case 'toolcall_delta': {
        this._status$.next('tool_calling');
        if (!updatedToolCalls) {
          updatedToolCalls = [];
        }
        const partialContent = assistantEvent.partial.content[assistantEvent.contentIndex];
        const toolCallId = partialContent?.type === 'toolCall' ? partialContent.id : undefined;
        const toolName = partialContent?.type === 'toolCall' ? partialContent.name : 'unknown';

        if (toolCallId) {
          const existingIndex = updatedToolCalls.findIndex((tc) => tc.id === toolCallId);
          if (existingIndex >= 0) {
            const existing = updatedToolCalls[existingIndex];
            updatedToolCalls[existingIndex] = {
              ...existing,
              args: { ...existing.args, _raw: ((existing.args._raw as string) ?? '') + assistantEvent.delta },
            };
          } else {
            updatedToolCalls.push({
              id: toolCallId,
              name: toolName,
              args: { _raw: assistantEvent.delta },
              status: 'running',
            });
          }
        }
        break;
      }
      case 'error': {
        this._status$.next('error');
        this._isStreaming$.next(false);
        const errorMessage = assistantEvent.error?.errorMessage ?? 'Unknown error';
        const errorMsg: IChatMessage = {
          ...current,
          content: current.content || errorMessage,
          isStreaming: false,
          error: errorMessage,
        };
        this._currentMessage$.next(null);
        this._appendMessage(errorMsg);
        this._persistMessage(errorMsg);
        this._messageCompleted$.next(errorMsg);
        return; // Skip the update below
      }
    }

    const updated: IChatMessage = {
      ...current,
      content: updatedContent,
      thinking: updatedThinking,
      toolCalls: updatedToolCalls,
    };
    this._currentMessage$.next(updated);
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

    let finalContent = '';
    let finalThinking = '';
    const toolCalls: IChatToolCall[] = [];

    for (const block of assistantMsg.content) {
      if (block.type === 'text') {
        finalContent += block.text;
      } else if (block.type === 'thinking') {
        finalThinking += block.thinking;
      } else if (block.type === 'toolCall') {
        // Use tracked tool execution results for accurate status
        const tracked = this._toolResults.get(block.id);
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: block.arguments ?? {},
          status: tracked?.status ?? 'success',
          error: tracked?.error,
        });
      }
    }

    const completedMessage: IChatMessage = {
      id: current.id,
      role: 'assistant',
      content: finalContent || current.content,
      createdAt: current.createdAt,
      thinking: finalThinking || current.thinking,
      toolCalls: toolCalls.length > 0
        ? toolCalls
        : current.toolCalls?.map((tc) => {
          const tracked = this._toolResults.get(tc.id);
          return { ...tc, status: tracked?.status ?? tc.status, error: tracked?.error };
        }),
      usage,
      isStreaming: false,
    };

    // Propagate API errors to the message
    if (assistantMsg.stopReason === 'error' && assistantMsg.errorMessage) {
      completedMessage.error = assistantMsg.errorMessage;
    }

    this._currentMessage$.next(null);
    this._appendMessage(completedMessage);
    this._persistMessage(completedMessage);
    this._messageCompleted$.next(completedMessage);
    this._isStreaming$.next(false);
    this._status$.next(completedMessage.error ? 'error' : 'idle');

    // Clear tool results for this turn
    this._toolResults.clear();

    // Evaluate auto-compaction after assistant message finalizes
    if (!completedMessage.error) {
      this._maybeAutoCompact();
    }
  }

  private _handleToolExecutionEnd(event: AgentEvent & { type: 'tool_execution_end' }): void {
    this._toolResults.set(event.toolCallId, {
      status: event.isError ? 'error' : 'success',
      error: event.isError ? String(event.result?.content?.[0]?.text ?? 'Tool execution failed') : undefined,
    });
  }

  private _handleAgentEnd(_event: AgentEvent & { type: 'agent_end' }): void {
    const lastAssistant = this._lastAssistantEvent?.message as AssistantMessage | undefined;
    const apiError = lastAssistant?.stopReason === 'error' ? lastAssistant.errorMessage : undefined;

    // Safety: if streaming is still active when agent ends, force cleanup
    const current = this._currentMessage$.getValue();
    if (current) {
      const completed: IChatMessage = {
        ...current,
        isStreaming: false,
        ...(apiError ? { error: apiError } : {}),
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

    if (lastAssistant && !this._aborted && this._isRetryableError(lastAssistant)) {
      this._attemptRetry();
      this._lastAssistantEvent = null;
      return;
    }

    this._retryAttempt = 0;
    this._resolveRetryPromise();
    this._lastAssistantEvent = null;
    this._aborted = false;

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
      console.warn(`[AIAgentService] Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded.`);
      this._retryAttempt = 0;
      this._resolveRetryPromise();
      this._status$.next('error');
      return;
    }

    const delayMs = RETRY_BASE_DELAY_MS * (2 ** (this._retryAttempt - 1));
    console.warn(`[AIAgentService] Retryable error detected, attempt ${this._retryAttempt}/${MAX_RETRY_ATTEMPTS}, waiting ${delayMs}ms...`);

    // Remove the error message from agent state
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
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.error) {
        this._messages$.next(currentMessages.slice(0, -1));
      }
    }

    this._status$.next('thinking');
    this._isStreaming$.next(true);

    // Create retry promise if not exists
    this._ensureRetryPromise();

    // Wait with exponential backoff then retry
    this._retryAbortController = new AbortController();
    const signal = this._retryAbortController.signal;

    this._sleep(delayMs, signal).then(() => {
      this._retryAbortController = null;
      if (signal.aborted || !this._agent) return;

      this._agent.continue().catch((err: any) => {
        console.error('[AIAgentService] Retry continue() failed:', err);
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
    const errorMessage: IChatMessage = {
      id: current?.id ?? generateRandomId(),
      role: 'assistant',
      content: current?.content ?? '',
      error: errorText,
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
}
