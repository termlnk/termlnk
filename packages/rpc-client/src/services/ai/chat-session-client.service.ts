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

import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

export interface IChatSessionChangeEvent {
  type: 'add' | 'update' | 'delete';
  sessionId: string;
}

export interface IChatSessionClientService {
  readonly sessions$: Observable<IChatSessionChangeEvent>;
  readonly currentSessionId$: Observable<string | null>;
  listSessions(): Promise<any[]>;
  getSession(sessionId: string): Promise<any>;
  getMessages(sessionId: string): Promise<any[]>;
  loadSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<void>;
  setSelectedSkills(sessionId: string, skillIds: string[]): Promise<void>;
  setSelectedTools(sessionId: string, toolIds: string[] | null): Promise<void>;
  newSession(): Promise<string>;
}

export const IChatSessionClientService = createIdentifier<IChatSessionClientService>('rpc-client.chat-session-client-service');

export class ChatSessionClientService extends Disposable implements IChatSessionClientService {
  readonly sessions$: Observable<IChatSessionChangeEvent>;
  readonly currentSessionId$: Observable<string | null>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();

    this.sessions$ = trpcSubscriptionToObservable<IChatSessionChangeEvent>((opts) =>
      this._client.sessions$.subscribe(undefined, opts)
    );

    this.currentSessionId$ = trpcSubscriptionToObservable<string | null>((opts) =>
      this._client.currentSessionId$.subscribe(undefined, opts)
    ).pipe(shareReplay(1));
  }

  private get _client() {
    return this._rpcClientService.getClient().chat;
  }

  async listSessions() {
    return this._client.listSessions.query();
  }

  async getSession(sessionId: string) {
    return this._client.getSession.query({ sessionId });
  }

  async getMessages(sessionId: string) {
    return this._client.getMessages.query({ sessionId });
  }

  async loadSession(sessionId: string): Promise<void> {
    await this._client.loadSession.mutate({ sessionId });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this._client.deleteSession.mutate({ sessionId });
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    await this._client.renameSession.mutate({ sessionId, title });
  }

  async setSelectedSkills(sessionId: string, skillIds: string[]): Promise<void> {
    await this._client.setSelectedSkills.mutate({ sessionId, skillIds });
  }

  async setSelectedTools(sessionId: string, toolIds: string[] | null): Promise<void> {
    await this._client.setSelectedTools.mutate({ sessionId, toolIds });
  }

  async newSession(): Promise<string> {
    return this._client.newSession.mutate();
  }
}
