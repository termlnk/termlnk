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
  IAgentToolPermissionRequest,
  IAgentToolPermissionResponse,
  IPermissionRule,
  IPermissionRuleInput,
  ToolPermissionMode,
  ToolPermissionScope,
} from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

export interface IPermissionClientService {
  readonly mode$: Observable<ToolPermissionMode>;
  readonly pendingRequests$: Observable<IAgentToolPermissionRequest[]>;
  readonly rules$: Observable<IPermissionRule[]>;

  getMode(): Promise<ToolPermissionMode>;
  setMode(mode: ToolPermissionMode): Promise<void>;
  respond(response: IAgentToolPermissionResponse): Promise<void>;
  clearSessionRules(sessionId: string): Promise<void>;

  listRules(scope?: ToolPermissionScope): Promise<IPermissionRule[]>;
  addRule(input: Omit<IPermissionRuleInput, 'scope'>): Promise<IPermissionRule>;
  removeRule(id: string): Promise<void>;
}

export const IPermissionClientService = createIdentifier<IPermissionClientService>(
  'rpc-client.permission-client-service'
);

export class PermissionClientService extends Disposable implements IPermissionClientService {
  readonly mode$: Observable<ToolPermissionMode>;
  readonly pendingRequests$: Observable<IAgentToolPermissionRequest[]>;
  readonly rules$: Observable<IPermissionRule[]>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();

    this.mode$ = trpcSubscriptionToObservable<ToolPermissionMode>((opts) =>
      this._client.mode$.subscribe(undefined, opts)
    ).pipe(shareReplay(1));

    // tRPC infers 'input?: unknown' from the zod schema while the model declares it
    // required; cast through unknown to bridge the optional/required mismatch.
    this.pendingRequests$ = trpcSubscriptionToObservable((opts) =>
      this._client.pendingRequests$.subscribe(undefined, opts)
    ).pipe(shareReplay(1)) as unknown as Observable<IAgentToolPermissionRequest[]>;

    this.rules$ = trpcSubscriptionToObservable<IPermissionRule[]>((opts) =>
      this._client.rules.rules$.subscribe(undefined, opts)
    ).pipe(shareReplay(1));
  }

  private get _client() {
    return this._rpcClientService.getClient().permission;
  }

  async getMode(): Promise<ToolPermissionMode> {
    return this._client.getMode.query();
  }

  async setMode(mode: ToolPermissionMode): Promise<void> {
    await this._client.setMode.mutate({ mode });
  }

  async respond(response: IAgentToolPermissionResponse): Promise<void> {
    await this._client.respond.mutate(response);
  }

  async clearSessionRules(sessionId: string): Promise<void> {
    await this._client.clearSessionRules.mutate({ sessionId });
  }

  async listRules(scope?: ToolPermissionScope): Promise<IPermissionRule[]> {
    return this._client.rules.list.query(scope ? { scope } : undefined) as Promise<IPermissionRule[]>;
  }

  async addRule(input: Omit<IPermissionRuleInput, 'scope'>): Promise<IPermissionRule> {
    return this._client.rules.add.mutate(input) as Promise<IPermissionRule>;
  }

  async removeRule(id: string): Promise<void> {
    await this._client.rules.remove.mutate({ id });
  }
}
