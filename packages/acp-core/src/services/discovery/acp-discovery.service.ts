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
  IACPDiscoveryService,
  IACPPluginConfig,
  IACPProviderDescriptor,
  IACPProviderStatus,
} from '@termlnk/acp';
import type { Observable } from 'rxjs';
import process from 'node:process';
import {
  ACP_PLUGIN_CONFIG_KEY,
  ACP_PROVIDER_CATALOG,
  DEFAULT_PROBE_TIMEOUT_MS,
} from '@termlnk/acp';
import { Disposable, IConfigService, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { BehaviorSubject, map } from 'rxjs';
import { resolveLoginShellEnv } from './login-shell-env';
import { probeProviderAvailability } from './probe-binary';

export class ACPDiscoveryService extends Disposable implements IACPDiscoveryService {
  private readonly _providers$ = new BehaviorSubject<IACPProviderStatus[]>([]);
  readonly providers$: Observable<IACPProviderStatus[]> = this._providers$.asObservable();
  readonly launchableProviders$: Observable<IACPProviderStatus[]> = this.providers$.pipe(
    map((list) =>
      list
        .filter((p) => p.availability.state === 'installed' || p.availability.state === 'on-demand')
        .sort((a, b) => {
          // Installed first, on-demand last; stable by title within group.
          const rank = (s: IACPProviderStatus) => (s.availability.state === 'installed' ? 0 : 1);
          const d = rank(a) - rank(b);
          return d !== 0 ? d : a.descriptor.title.localeCompare(b.descriptor.title);
        })
    )
  );

  private _refreshing: Promise<void> | null = null;
  private _shellEnv: Record<string, string> = { ...process.env } as Record<string, string>;

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository
  ) {
    super();
    void this.refresh();
  }

  get providers(): IACPProviderStatus[] {
    return this._providers$.getValue();
  }

  get launchableProviders(): IACPProviderStatus[] {
    return this.providers
      .filter((p) => p.availability.state === 'installed' || p.availability.state === 'on-demand')
      .sort((a, b) => {
        const rank = (s: IACPProviderStatus) => (s.availability.state === 'installed' ? 0 : 1);
        const d = rank(a) - rank(b);
        return d !== 0 ? d : a.descriptor.title.localeCompare(b.descriptor.title);
      });
  }

  getProvider(id: string): IACPProviderStatus | undefined {
    return this._providers$.getValue().find((p) => p.descriptor.id === id);
  }

  async refresh(): Promise<void> {
    if (this._refreshing) {
      return this._refreshing;
    }
    this._refreshing = this._doRefresh().finally(() => {
      this._refreshing = null;
    });
    return this._refreshing;
  }

  async addUserProvider(descriptor: Omit<IACPProviderDescriptor, 'source'>): Promise<void> {
    const full: IACPProviderDescriptor = { ...descriptor, source: 'user' };
    const current = await this._loadUserProviders();
    if (current.some((p) => p.id === full.id) || ACP_PROVIDER_CATALOG.some((p) => p.id === full.id)) {
      throw new Error(`Provider id already exists: ${full.id}`);
    }
    const next = [...current, full];
    await this._saveUserProviders(next);
    await this.refresh();
  }

  async removeUserProvider(id: string): Promise<void> {
    const current = await this._loadUserProviders();
    const next = current.filter((p) => p.id !== id);
    if (next.length === current.length) {
      return;
    }
    await this._saveUserProviders(next);
    await this.refresh();
  }

  override dispose(): void {
    super.dispose();
    this._providers$.complete();
  }

  private async _doRefresh(): Promise<void> {
    try {
      this._shellEnv = await resolveLoginShellEnv();
    } catch (err) {
      this._logService.warn('[ACPDiscovery] login-shell env resolve failed, using process.env', err);
      this._shellEnv = { ...process.env } as Record<string, string>;
    }

    const cfg = this._configService.getConfig<IACPPluginConfig>(ACP_PLUGIN_CONFIG_KEY);
    const probeTimeoutMs = cfg?.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
    const userProviders = await this._loadUserProviders();
    const all = [...ACP_PROVIDER_CATALOG, ...userProviders];

    const statuses = await Promise.all(
      all.map(async (descriptor): Promise<IACPProviderStatus> => {
        const availability = await probeProviderAvailability(
          descriptor.command,
          this._shellEnv,
          { probeTimeoutMs }
        );
        return { descriptor, availability };
      })
    );

    this._providers$.next(statuses);
  }

  private async _loadUserProviders(): Promise<IACPProviderDescriptor[]> {
    const stored = await this._configRepository.getField<IACPProviderDescriptor[]>(
      ACP_PLUGIN_CONFIG_KEY,
      'userProviders'
    );
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored.map((p) => ({ ...p, source: 'user' as const }));
  }

  private async _saveUserProviders(providers: IACPProviderDescriptor[]): Promise<void> {
    await this._configRepository.setField(ACP_PLUGIN_CONFIG_KEY, 'userProviders', providers);
    const cfg = this._configService.getConfig<IACPPluginConfig>(ACP_PLUGIN_CONFIG_KEY) ?? {};
    this._configService.setConfig(ACP_PLUGIN_CONFIG_KEY, {
      ...cfg,
      userProviders: providers,
    });
  }
}
