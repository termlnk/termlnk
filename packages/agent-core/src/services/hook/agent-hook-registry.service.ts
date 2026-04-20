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

import type { ExternalAgentType, IAgentHookAdapter, IAgentHookRegistryService } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export class AgentHookRegistryService extends Disposable implements IAgentHookRegistryService {
  private readonly _adapters$ = new BehaviorSubject<IAgentHookAdapter[]>([]);
  readonly adapters$: Observable<IAgentHookAdapter[]> = this._adapters$.asObservable();

  private readonly _adapterMap = new Map<ExternalAgentType, IAgentHookAdapter>();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this.disposeWithMe(toDisposable(() => {
      this._adapters$.complete();
    }));
  }

  registerAdapter(adapter: IAgentHookAdapter): void {
    this._adapterMap.set(adapter.agentType, adapter);
    this._emitAdapters();
    this._logService.log('[AgentHookRegistry]', `Registered adapter: ${adapter.definition.displayName}`);
  }

  getAdapter(agentType: ExternalAgentType): IAgentHookAdapter | undefined {
    return this._adapterMap.get(agentType);
  }

  getAdapters(): IAgentHookAdapter[] {
    return [...this._adapterMap.values()];
  }

  async installAll(port: number, token: string): Promise<void> {
    const results = await Promise.allSettled(
      this.getAdapters().map(async (adapter) => {
        const available = await adapter.isAvailable();
        if (!available) {
          this._logService.log(
            '[AgentHookRegistry]',
            `${adapter.definition.displayName} not available, skipping install`
          );
          return;
        }
        await adapter.install(port, token);
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this._logService.warn('[AgentHookRegistry]', 'Adapter install failed:', result.reason);
      }
    }
  }

  async uninstallAll(): Promise<void> {
    const results = await Promise.allSettled(
      this.getAdapters().map((adapter) => adapter.uninstall())
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this._logService.warn('[AgentHookRegistry]', 'Adapter uninstall failed:', result.reason);
      }
    }
  }

  async getAvailableAgents(): Promise<ExternalAgentType[]> {
    const checks = await Promise.allSettled(
      this.getAdapters().map(async (adapter) => {
        const available = await adapter.isAvailable();
        return available ? adapter.agentType : null;
      })
    );

    return checks
      .filter((r): r is PromiseFulfilledResult<ExternalAgentType | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((v): v is ExternalAgentType => v !== null);
  }

  override dispose(): void {
    for (const adapter of this._adapterMap.values()) {
      adapter.dispose();
    }
    this._adapterMap.clear();
    super.dispose();
  }

  private _emitAdapters(): void {
    this._adapters$.next([...this._adapterMap.values()]);
  }
}
