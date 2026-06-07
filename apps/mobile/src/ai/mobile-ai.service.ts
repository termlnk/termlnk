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
import type { Observable } from 'rxjs';
import type { IMobilePreferencesService } from '../platform/mobile-preferences.service';
import { createIdentifier, Disposable, generateRandomId, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { deleteItemAsync, getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { BehaviorSubject } from 'rxjs';
import { IMobilePreferencesService as IMobilePreferencesServiceId } from '../platform/mobile-preferences.service';

// Mobile AI assistant. v1 talks directly to an OpenAI-compatible Chat Completions endpoint
// (base URL + model from preferences, API key from the OS keystore). Non-streaming: React
// Native's fetch has no reliable ReadableStream reader, so we await the full completion
// rather than ship a half-working SSE parser. Tool calling (terminal_run) and MCP are not
// wired yet — see the desktop @termlnk/agent-core for the full agent loop.

export type AiRole = 'user' | 'assistant';

export interface IAiMessage {
  readonly id: string;
  readonly role: AiRole;
  readonly content: string;
  readonly pending?: boolean;
  readonly error?: boolean;
}

const API_KEY_STORE = 'termlnk.mobile.ai-api-key';

export interface IMobileAiService {
  readonly messages$: Observable<readonly IAiMessage[]>;
  readonly sending$: Observable<boolean>;
  hasApiKey(): Promise<boolean>;
  setApiKey(key: string): Promise<void>;
  clearApiKey(): Promise<void>;
  send(text: string): Promise<void>;
  reset(): void;
}

export const IMobileAiService = createIdentifier<IMobileAiService>('mobile.ai.service');

interface IChatChoice {
  message?: { content?: string };
}
interface IChatResponse {
  choices?: IChatChoice[];
  error?: { message?: string };
}

export class MobileAiService extends Disposable implements IMobileAiService {
  private readonly _messages$ = new BehaviorSubject<readonly IAiMessage[]>([]);
  readonly messages$: Observable<readonly IAiMessage[]> = this._messages$.asObservable();

  private readonly _sending$ = new BehaviorSubject<boolean>(false);
  readonly sending$: Observable<boolean> = this._sending$.asObservable();

  private readonly _prefs: IMobilePreferencesService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IMobilePreferencesServiceId) prefs: IMobilePreferencesService,
    @Inject(ILogServiceId) logService: ILogService
  ) {
    super();
    this._prefs = prefs;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._messages$.complete();
    this._sending$.complete();
  }

  async hasApiKey(): Promise<boolean> {
    const key = await getItemAsync(API_KEY_STORE, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return !!key;
  }

  async setApiKey(key: string): Promise<void> {
    await setItemAsync(API_KEY_STORE, key, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }

  async clearApiKey(): Promise<void> {
    await deleteItemAsync(API_KEY_STORE, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }

  reset(): void {
    this._messages$.next([]);
  }

  async send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (trimmed.length === 0 || this._sending$.getValue()) {
      return;
    }
    const apiKey = await getItemAsync(API_KEY_STORE, { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    if (!apiKey) {
      throw new Error('No API key configured. Add one in AI settings.');
    }
    await this._prefs.ready();
    const { aiBaseUrl, aiModel } = this._prefs.get();

    const userMsg: IAiMessage = { id: generateRandomId(12), role: 'user', content: trimmed };
    const assistantId = generateRandomId(12);
    const history = [...this._messages$.getValue(), userMsg];
    this._messages$.next([...history, { id: assistantId, role: 'assistant', content: '', pending: true }]);
    this._sending$.next(true);

    try {
      const resp = await fetch(`${aiBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: aiModel,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = (await resp.json()) as IChatResponse;
      if (!resp.ok) {
        throw new Error(json.error?.message ?? `HTTP ${resp.status}`);
      }
      const content = json.choices?.[0]?.message?.content ?? '(empty response)';
      this._replace(assistantId, { id: assistantId, role: 'assistant', content });
    } catch (err) {
      this._logService.warn('[MobileAiService] completion failed:', err);
      this._replace(assistantId, {
        id: assistantId,
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Request failed',
        error: true,
      });
    } finally {
      this._sending$.next(false);
    }
  }

  private _replace(id: string, next: IAiMessage): void {
    this._messages$.next(this._messages$.getValue().map((m) => (m.id === id ? next : m)));
  }
}
