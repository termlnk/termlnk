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

import type { IPortForwardingRule, IPortForwardingRuleCreateInput, IPortForwardingRuleUpdateInput, IPortForwardingRuntimeState, PortForwardingAuthEvent, PortForwardingHostKeyAction } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { IPortForwardingService, trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export class PortForwardingClientService extends Disposable implements IPortForwardingService {
  // Built once so React hook references are stable across renders; the underlying
  // observable is cold — each subscriber still gets its own tRPC subscription.
  readonly rules$: Observable<IPortForwardingRule[]>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
    this.rules$ = trpcSubscriptionToObservable<IPortForwardingRule[]>((opts) =>
      this._client().rules$.subscribe(undefined, opts)
    );
  }

  async listRules(): Promise<IPortForwardingRule[]> {
    return this._client().list.query();
  }

  async createRule(input: IPortForwardingRuleCreateInput): Promise<IPortForwardingRule> {
    return this._client().create.mutate(input);
  }

  async updateRule(id: string, patch: IPortForwardingRuleUpdateInput): Promise<IPortForwardingRule> {
    return this._client().update.mutate({ id, patch });
  }

  async deleteRule(id: string): Promise<void> {
    await this._client().delete.mutate({ id });
  }

  async startRule(ruleId: string, options?: { password?: string }): Promise<void> {
    await this._client().start.mutate({ ruleId, password: options?.password });
  }

  async stopRule(ruleId: string): Promise<void> {
    await this._client().stop.mutate({ ruleId });
  }

  async restartRule(ruleId: string, options?: { password?: string }): Promise<void> {
    await this._client().restart.mutate({ ruleId, password: options?.password });
  }

  async respondKeyboardInteractive(ruleId: string, responses: string[]): Promise<void> {
    await this._client().respondKeyboardInteractive.mutate({ ruleId, responses });
  }

  async respondChangePassword(ruleId: string, newPassword: string): Promise<void> {
    await this._client().respondChangePassword.mutate({ ruleId, newPassword });
  }

  async respondHostKeyPrompt(ruleId: string, action: PortForwardingHostKeyAction): Promise<void> {
    await this._client().respondHostKeyPrompt.mutate({ ruleId, action });
  }

  state$(ruleId: string): Observable<IPortForwardingRuntimeState> {
    return trpcSubscriptionToObservable((opts) => this._client().state$.subscribe({ ruleId }, opts));
  }

  authEvent$(ruleId: string): Observable<PortForwardingAuthEvent> {
    return trpcSubscriptionToObservable((opts) => this._client().authEvent$.subscribe({ ruleId }, opts));
  }

  private _client() {
    return this._rpcClientService.getClient().portForwarding;
  }
}
