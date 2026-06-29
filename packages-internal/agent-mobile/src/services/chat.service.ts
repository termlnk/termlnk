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

import type { ILogService } from '@termlnk/core';
import type { IDatabaseMobileAdaptorService } from '@termlnk/database-mobile';
import type { Observable } from 'rxjs';
import type { IChatUsage, IMobileChatMessage, IMobileMessagePart, IMobileSendMessageOptions, MobileAgentStatus, MobileThinkingLevel } from '../models/message';
import type { IMobileProviderService } from './provider.service';
import type { IStreamDelta } from './stream/openai-stream';
import { createIdentifier, Disposable, generateRandomId, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { aiChatMessageEntity, aiChatSessionEntity, IDatabaseMobileAdaptorService as IDatabaseMobileAdaptorServiceId } from '@termlnk/database-mobile';
import { asc, eq } from 'drizzle-orm';
import { BehaviorSubject } from 'rxjs';
import { IMobileProviderService as IMobileProviderServiceId } from './provider.service';
import { streamAnthropicMessages, buildAnthropicMessages } from './stream/anthropic-stream';
import { buildOpenAIMessages, streamOpenAICompletions } from './stream/openai-stream';

const TRANSIENT_ERROR = /overloaded|rate.?limit|429|500|503|504|service.?unavailable|connection|retry/i;
const MAX_RETRIES = 3;
const TITLE_GENERATION_PROMPT = 'Generate a very short title (under 6 words) for this conversation. Respond with only the title, no quotes or punctuation.';

export interface IMobileChatService {
  readonly messages$: Observable<readonly IMobileChatMessage[]>;
  readonly status$: Observable<MobileAgentStatus>;
  readonly currentMessage$: Observable<IMobileChatMessage | null>;
  readonly currentSessionId$: Observable<string | null>;
  readonly thinkingLevel$: Observable<MobileThinkingLevel>;

  sendMessage(content: string, options?: IMobileSendMessageOptions): Promise<void>;
  stopStreaming(): void;
  clearMessages(): void;
  setThinkingLevel(level: MobileThinkingLevel): void;

  loadSession(sessionId: string): Promise<void>;
  createNewSession(): Promise<string>;
  getCurrentSessionId(): string | null;
}

export const IMobileChatService = createIdentifier<IMobileChatService>('mobile.chat.service');

export class MobileChatService extends Disposable implements IMobileChatService {
  private readonly _messages$ = new BehaviorSubject<readonly IMobileChatMessage[]>([]);
  readonly messages$: Observable<readonly IMobileChatMessage[]> = this._messages$.asObservable();

  private readonly _status$ = new BehaviorSubject<MobileAgentStatus>('idle');
  readonly status$: Observable<MobileAgentStatus> = this._status$.asObservable();

  private readonly _currentMessage$ = new BehaviorSubject<IMobileChatMessage | null>(null);
  readonly currentMessage$: Observable<IMobileChatMessage | null> = this._currentMessage$.asObservable();

  private readonly _currentSessionId$ = new BehaviorSubject<string | null>(null);
  readonly currentSessionId$: Observable<string | null> = this._currentSessionId$.asObservable();

  private readonly _thinkingLevel$ = new BehaviorSubject<MobileThinkingLevel>('high');
  readonly thinkingLevel$: Observable<MobileThinkingLevel> = this._thinkingLevel$.asObservable();

  private _abortController: AbortController | null = null;
  private _sortCounter = 0;

  private readonly _dbAdaptor: IDatabaseMobileAdaptorService;
  private readonly _providerService: IMobileProviderService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IDatabaseMobileAdaptorServiceId) dbAdaptor: IDatabaseMobileAdaptorService,
    @Inject(IMobileProviderServiceId) providerService: IMobileProviderService,
    @Inject(ILogServiceId) logService: ILogService
  ) {
    super();
    this._dbAdaptor = dbAdaptor;
    this._providerService = providerService;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._abortController?.abort();
    this._messages$.complete();
    this._status$.complete();
    this._currentMessage$.complete();
    this._currentSessionId$.complete();
    this._thinkingLevel$.complete();
  }

  async sendMessage(content: string, options?: IMobileSendMessageOptions): Promise<void> {
    const trimmed = content.trim();
    if (trimmed.length === 0 && (!options?.images || options.images.length === 0)) {
      return;
    }
    if (this._status$.getValue() !== 'idle') {
      return;
    }

    if (!this._currentSessionId$.getValue()) {
      await this.createNewSession();
    }

    const parts: IMobileMessagePart[] = [];
    if (options?.images) {
      for (const img of options.images) {
        parts.push({ type: 'image', data: img.data, mimeType: img.mimeType });
      }
    }
    if (trimmed.length > 0) {
      parts.push({ type: 'text', text: trimmed });
    }

    const userMsg: IMobileChatMessage = {
      id: generateRandomId(12),
      role: 'user',
      parts,
      createdAt: Date.now(),
    };

    const history = [...this._messages$.getValue(), userMsg];
    this._messages$.next(history);
    await this._persistMessage(userMsg);

    const validationError = await this._validateProvider();
    if (validationError) {
      this._appendErrorMessage(validationError);
      return;
    }

    const activeModel = this._providerService.getActiveModel()!;
    const provider = this._providerService.getProviderConfig(activeModel.providerId)!;
    const apiKey = (await this._providerService.getApiKey(activeModel.providerId))!;

    const thinkingLevel = this._thinkingLevel$.getValue();
    const reasoning = activeModel.reasoning && thinkingLevel !== 'off';

    await this._streamReply(provider.api, provider.baseUrl!, apiKey, activeModel.modelId, history, reasoning, activeModel.maxTokens, provider.headers);
  }

  setThinkingLevel(level: MobileThinkingLevel): void {
    this._thinkingLevel$.next(level);
  }

  stopStreaming(): void {
    this._abortController?.abort();
    this._abortController = null;
    const current = this._currentMessage$.getValue();
    if (current) {
      const finalized: IMobileChatMessage = { ...current, isStreaming: false };
      this._messages$.next([...this._messages$.getValue(), finalized]);
      void this._persistMessage(finalized);
      this._currentMessage$.next(null);
    }
    this._status$.next('idle');
  }

  clearMessages(): void {
    this._abortController?.abort();
    this._abortController = null;
    this._messages$.next([]);
    this._currentMessage$.next(null);
    this._status$.next('idle');
    this._sortCounter = 0;
    const sessionId = this._currentSessionId$.getValue();
    if (sessionId) {
      void this._clearSessionMessages(sessionId);
    }
  }

  async loadSession(sessionId: string): Promise<void> {
    this._abortController?.abort();
    this._currentMessage$.next(null);
    this._status$.next('idle');

    const db = await this._dbAdaptor.ready();
    const rows = db.select()
      .from(aiChatMessageEntity)
      .where(eq(aiChatMessageEntity.sessionId, sessionId))
      .orderBy(asc(aiChatMessageEntity.sortOrder))
      .all();

    const messages: IMobileChatMessage[] = rows.map((row) => ({
      id: row.id,
      role: row.role as IMobileChatMessage['role'],
      parts: JSON.parse(row.parts) as IMobileMessagePart[],
      usage: row.usage ? JSON.parse(row.usage) as IChatUsage : undefined,
      createdAt: new Date(row.createdAt).getTime(),
    }));

    this._messages$.next(messages);
    this._currentSessionId$.next(sessionId);
    this._sortCounter = rows.length;

    db.update(aiChatSessionEntity)
      .set({ accessedAt: new Date().toISOString() })
      .where(eq(aiChatSessionEntity.id, sessionId))
      .run();
  }

  async createNewSession(): Promise<string> {
    this._abortController?.abort();
    this._messages$.next([]);
    this._currentMessage$.next(null);
    this._status$.next('idle');
    this._sortCounter = 0;

    const db = await this._dbAdaptor.ready();
    const id = generateRandomId(12);
    const now = new Date().toISOString();

    const activeModel = this._providerService.getActiveModel();

    db.insert(aiChatSessionEntity).values({
      id,
      title: 'New Chat',
      providerId: activeModel?.providerId ?? null,
      modelId: activeModel?.modelId ?? null,
      messageCount: 0,
      accessedAt: now,
    }).run();

    this._currentSessionId$.next(id);
    return id;
  }

  getCurrentSessionId(): string | null {
    return this._currentSessionId$.getValue();
  }

  private async _streamReply(
    apiType: string,
    baseUrl: string,
    apiKey: string,
    modelId: string,
    history: readonly IMobileChatMessage[],
    reasoning: boolean,
    maxTokens: number,
    headers?: Record<string, string>,
    retryCount = 0
  ): Promise<void> {
    const assistantId = generateRandomId(12);
    this._status$.next('thinking');
    this._abortController = new AbortController();

    const buildMessages = apiType === 'anthropic-messages' ? buildAnthropicMessages : buildOpenAIMessages;
    const apiMessages = history.map((m) => ({
      role: m.role,
      content: buildMessages(m.parts),
    }));

    let textAccum = '';
    let thinkingAccum = '';
    let usage: IChatUsage | undefined;

    const updateCurrent = () => {
      const parts: IMobileMessagePart[] = [];
      if (thinkingAccum.length > 0) {
        parts.push({ type: 'thinking', thinking: thinkingAccum });
      }
      if (textAccum.length > 0) {
        parts.push({ type: 'text', text: textAccum });
      }
      this._currentMessage$.next({
        id: assistantId,
        role: 'assistant',
        parts,
        isStreaming: true,
        usage,
        createdAt: Date.now(),
      });
    };

    try {
      let stream: AsyncGenerator<IStreamDelta>;

      if (apiType === 'anthropic-messages') {
        stream = streamAnthropicMessages(baseUrl, apiKey, modelId, apiMessages, { reasoning, maxTokens, headers, signal: this._abortController.signal });
      } else {
        stream = streamOpenAICompletions(baseUrl, apiKey, modelId, apiMessages, headers, this._abortController.signal);
      }

      for await (const delta of stream) {
        if (delta.done) {
          if (delta.usage) {
            usage = delta.usage;
          }
          break;
        }

        if (delta.textDelta) {
          if (this._status$.getValue() === 'thinking') {
            this._status$.next('streaming');
          }
          textAccum += delta.textDelta;
          updateCurrent();
        }

        if (delta.thinkingDelta) {
          thinkingAccum += delta.thinkingDelta;
          updateCurrent();
        }

        if (delta.usage) {
          usage = delta.usage;
        }
      }

      const finalParts: IMobileMessagePart[] = [];
      if (thinkingAccum.length > 0) {
        finalParts.push({ type: 'thinking', thinking: thinkingAccum });
      }
      if (textAccum.length > 0) {
        finalParts.push({ type: 'text', text: textAccum });
      }
      if (finalParts.length === 0) {
        finalParts.push({ type: 'text', text: '(empty response)' });
      }

      const finalMessage: IMobileChatMessage = {
        id: assistantId,
        role: 'assistant',
        parts: finalParts,
        usage,
        createdAt: Date.now(),
      };

      this._messages$.next([...this._messages$.getValue(), finalMessage]);
      this._currentMessage$.next(null);
      this._status$.next('idle');
      this._abortController = null;

      await this._persistMessage(finalMessage);
      await this._updateSessionMessageCount();

      if (this._messages$.getValue().length === 2) {
        void this._generateSessionTitle(apiType, baseUrl, apiKey, modelId, headers);
      }
    } catch (err) {
      this._abortController = null;

      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Request failed';

      if (retryCount < MAX_RETRIES && TRANSIENT_ERROR.test(errorMessage)) {
        this._logService.warn(`[MobileChatService] Transient error, retrying (${retryCount + 1}/${MAX_RETRIES}):`, errorMessage);
        const delay = 2000 * 2 ** retryCount;
        await new Promise<void>((r) => setTimeout(r, delay));
        return this._streamReply(apiType, baseUrl, apiKey, modelId, history, reasoning, maxTokens, headers, retryCount + 1);
      }

      const errorMsg: IMobileChatMessage = {
        id: assistantId,
        role: 'assistant',
        parts: [{ type: 'error', message: errorMessage }],
        createdAt: Date.now(),
      };

      this._messages$.next([...this._messages$.getValue(), errorMsg]);
      this._currentMessage$.next(null);
      this._status$.next('idle');

      await this._persistMessage(errorMsg);
    }
  }

  private async _validateProvider(): Promise<string | null> {
    await this._providerService.initialize();

    const activeModel = this._providerService.getActiveModel();
    if (!activeModel) {
      return 'No model selected. Configure a provider and select a model first.';
    }

    const provider = this._providerService.getProviderConfig(activeModel.providerId);
    if (!provider) {
      return 'Provider not found.';
    }

    if (!provider.baseUrl) {
      return 'Provider has no base URL configured.';
    }

    const apiKey = await this._providerService.getApiKey(activeModel.providerId);
    if (!apiKey) {
      return 'No API key configured for this provider.';
    }

    return null;
  }

  private _appendErrorMessage(message: string): void {
    const errorMsg: IMobileChatMessage = {
      id: generateRandomId(12),
      role: 'assistant',
      parts: [{ type: 'error', message }],
      createdAt: Date.now(),
    };
    this._messages$.next([...this._messages$.getValue(), errorMsg]);
    void this._persistMessage(errorMsg);
  }

  private async _persistMessage(msg: IMobileChatMessage): Promise<void> {
    const sessionId = this._currentSessionId$.getValue();
    if (!sessionId) {
      return;
    }
    try {
      const db = await this._dbAdaptor.ready();
      db.insert(aiChatMessageEntity).values({
        id: msg.id,
        sessionId,
        role: msg.role,
        parts: JSON.stringify(msg.parts),
        usage: msg.usage ? JSON.stringify(msg.usage) : null,
        sortOrder: this._sortCounter++,
      }).run();
    } catch (err) {
      this._logService.warn('[MobileChatService] Failed to persist message:', err);
    }
  }

  private async _updateSessionMessageCount(): Promise<void> {
    const sessionId = this._currentSessionId$.getValue();
    if (!sessionId) {
      return;
    }
    try {
      const db = await this._dbAdaptor.ready();
      const count = this._messages$.getValue().length;
      db.update(aiChatSessionEntity)
        .set({ messageCount: count, updatedAt: new Date().toISOString() })
        .where(eq(aiChatSessionEntity.id, sessionId))
        .run();
    } catch (err) {
      this._logService.warn('[MobileChatService] Failed to update session count:', err);
    }
  }

  private async _clearSessionMessages(sessionId: string): Promise<void> {
    try {
      const db = await this._dbAdaptor.ready();
      db.delete(aiChatMessageEntity).where(eq(aiChatMessageEntity.sessionId, sessionId)).run();
      db.update(aiChatSessionEntity)
        .set({ messageCount: 0, updatedAt: new Date().toISOString() })
        .where(eq(aiChatSessionEntity.id, sessionId))
        .run();
    } catch (err) {
      this._logService.warn('[MobileChatService] Failed to clear messages:', err);
    }
  }

  private async _generateSessionTitle(
    apiType: string,
    baseUrl: string,
    apiKey: string,
    modelId: string,
    headers?: Record<string, string>
  ): Promise<void> {
    const sessionId = this._currentSessionId$.getValue();
    if (!sessionId) {
      return;
    }

    try {
      const msgs = this._messages$.getValue();
      const context = msgs.slice(0, 2).map((m) => ({
        role: m.role,
        content: buildOpenAIMessages(m.parts),
      }));
      context.push({ role: 'user', content: TITLE_GENERATION_PROMPT });

      let title = '';

      if (apiType === 'anthropic-messages') {
        const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ model: modelId, messages: context, max_tokens: 32 }),
        });
        if (resp.ok) {
          const json = await resp.json() as { content?: Array<{ text?: string }> };
          title = json.content?.[0]?.text?.trim() ?? '';
        }
      } else {
        const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${apiKey}`,
            'content-type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ model: modelId, messages: context, max_tokens: 32 }),
        });
        if (resp.ok) {
          const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
          title = json.choices?.[0]?.message?.content?.trim() ?? '';
        }
      }

      if (title.length > 0 && title.length < 100) {
        const db = await this._dbAdaptor.ready();
        db.update(aiChatSessionEntity)
          .set({ title, updatedAt: new Date().toISOString() })
          .where(eq(aiChatSessionEntity.id, sessionId))
          .run();
      }
    } catch (err) {
      this._logService.warn('[MobileChatService] Title generation failed:', err);
    }
  }
}
