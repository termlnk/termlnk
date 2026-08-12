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

import type {
  IACPPromptBlock,
  IACPSessionInfo,
  IACPSessionService,
  IACPStreamEvent,
  ICreateACPSessionParams,
} from '@termlnk/acp';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { IRPCClientService } from '../rpc-client.service';

export class ACPSessionService extends Disposable implements IACPSessionService {
  private readonly _sessions$ = new BehaviorSubject<IACPSessionInfo[]>([]);
  readonly sessions$: Observable<IACPSessionInfo[]> = this._sessions$.asObservable();

  private readonly _eventStreams = new Map<string, Observable<IACPStreamEvent>>();

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();

    const live$ = trpcSubscriptionToObservable<IACPSessionInfo[]>((opts) =>
      this._client.sessions$.subscribe(undefined, opts)
    ).pipe(shareReplay(1));

    this.disposeWithMe(live$.subscribe((list) => this._sessions$.next(list)));

    void this._client.listSessions.query().then((list) => {
      if (this._sessions$.getValue().length === 0) {
        this._sessions$.next(list);
      }
    }).catch(() => {
      // subscription will fill later
    });
  }

  get sessions(): IACPSessionInfo[] {
    return this._sessions$.getValue();
  }

  getSession(sessionId: string): IACPSessionInfo | undefined {
    return this.sessions.find((s) => s.id === sessionId);
  }

  events$(sessionId: string): Observable<IACPStreamEvent> {
    let stream = this._eventStreams.get(sessionId);
    if (!stream) {
      stream = trpcSubscriptionToObservable<IACPStreamEvent>((opts) =>
        this._client.events$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 0, refCount: true }));
      this._eventStreams.set(sessionId, stream);
    }
    return stream;
  }

  async createSession(params: ICreateACPSessionParams): Promise<IACPSessionInfo> {
    return this._client.createSession.mutate(params);
  }

  async closeSession(sessionId: string): Promise<void> {
    await this._client.closeSession.mutate({ sessionId });
    this._eventStreams.delete(sessionId);
  }

  async prompt(sessionId: string, blocks: IACPPromptBlock[]): Promise<void> {
    await this._client.prompt.mutate({ sessionId, blocks });
  }

  async cancel(sessionId: string): Promise<void> {
    await this._client.cancel.mutate({ sessionId });
  }

  async respondPermission(sessionId: string, requestId: string, optionId: string): Promise<void> {
    await this._client.respondPermission.mutate({ sessionId, requestId, optionId });
  }

  async setMode(sessionId: string, modeId: string): Promise<void> {
    await this._client.setMode.mutate({ sessionId, modeId });
  }

  async setModel(sessionId: string, modelId: string): Promise<void> {
    await this._client.setModel.mutate({ sessionId, modelId });
  }

  async diagnose(providerId: string): Promise<string> {
    return this._client.diagnose.query(providerId);
  }

  override dispose(): void {
    this._sessions$.complete();
    this._eventStreams.clear();
    super.dispose();
  }

  private get _client() {
    return this._rpcClientService.getClient().acp;
  }
}
