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
  IACPProviderCapabilities,
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
import { probeProviderCapabilities } from './acp-capability-probe';
import { resolveLoginShellEnv } from './login-shell-env';
import { probeProviderAvailability } from './probe-binary';

type RecordField = 'providerCapabilities' | 'customModels';

/** Installed first, on-demand last; stable by title within each group. */
function compareForMenu(a: IACPProviderStatus, b: IACPProviderStatus): number {
  const rank = (s: IACPProviderStatus) => (s.availability.state === 'installed' ? 0 : 1);
  const delta = rank(a) - rank(b);
  return delta !== 0 ? delta : a.descriptor.title.localeCompare(b.descriptor.title);
}

function isLaunchable(status: IACPProviderStatus): boolean {
  return status.enabled
    && (status.availability.state === 'installed' || status.availability.state === 'on-demand');
}

export class ACPDiscoveryService extends Disposable implements IACPDiscoveryService {
  private readonly _providers$ = new BehaviorSubject<IACPProviderStatus[]>([]);
  readonly providers$: Observable<IACPProviderStatus[]> = this._providers$.asObservable();
  readonly launchableProviders$: Observable<IACPProviderStatus[]> = this.providers$.pipe(
    map((list) => list.filter(isLaunchable).sort(compareForMenu))
  );

  private _refreshing: Promise<void> | null = null;
  private _shellEnv: Record<string, string> = { ...process.env } as Record<string, string>;
  private readonly _probing = new Map<string, Promise<IACPProviderCapabilities>>();

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
    return this.providers.filter(isLaunchable).sort(compareForMenu);
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
    await this._persist('userProviders', [...current, full]);
    await this.refresh();
  }

  async removeUserProvider(id: string): Promise<void> {
    const current = await this._loadUserProviders();
    const next = current.filter((p) => p.id !== id);
    if (next.length === current.length) {
      return;
    }
    await this._persist('userProviders', next);
    // Leftover capability / model entries would resurface if the id is re-added.
    await this._patchRecord<IACPProviderCapabilities>('providerCapabilities', (record) => {
      delete record[id];
    });
    await this._patchRecord<string[]>('customModels', (record) => {
      delete record[id];
    });
    await this.refresh();
  }

  async setProviderEnabled(id: string, enabled: boolean): Promise<void> {
    const disabled = new Set(await this._loadDisabled());
    if (enabled) {
      disabled.delete(id);
    } else {
      disabled.add(id);
    }
    await this._persist('disabledProviders', [...disabled]);
    this._providers$.next(
      this.providers.map((p) => (p.descriptor.id === id ? { ...p, enabled } : p))
    );
  }

  async probeCapabilities(id: string, force = false): Promise<IACPProviderCapabilities> {
    const status = this.getProvider(id);
    if (!status) {
      throw new Error(`Unknown ACP provider: ${id}`);
    }
    if (!force && status.capabilities) {
      return status.capabilities;
    }

    // Coalesce: the settings dialog can ask more than once for the same provider,
    // and each probe costs a process spawn.
    const inFlight = this._probing.get(id);
    if (inFlight) {
      return inFlight;
    }

    const cfg = this._configService.getConfig<IACPPluginConfig>(ACP_PLUGIN_CONFIG_KEY);
    const run = probeProviderCapabilities(
      {
        descriptor: status.descriptor,
        env: this._shellEnv,
        handshakeTimeoutMs: cfg?.handshakeTimeoutMs,
      },
      this._logService
    )
      .then(async (probed) => {
        await this._patchRecord<IACPProviderCapabilities>('providerCapabilities', (record) => {
          record[id] = probed;
        });
        const merged = await this._withCustomModels(id, probed);
        this._providers$.next(
          this.providers.map((p) =>
            p.descriptor.id === id ? { ...p, capabilities: merged } : p
          )
        );
        return merged;
      })
      .finally(() => {
        this._probing.delete(id);
      });

    this._probing.set(id, run);
    return run;
  }

  async addCustomModel(providerId: string, modelId: string): Promise<void> {
    const trimmed = modelId.trim();
    if (!trimmed) {
      return;
    }
    await this._patchRecord<string[]>('customModels', (record) => {
      const existing = record[providerId] ?? [];
      if (!existing.includes(trimmed)) {
        record[providerId] = [...existing, trimmed];
      }
    });
    await this.refresh();
  }

  async removeCustomModel(providerId: string, modelId: string): Promise<void> {
    await this._patchRecord<string[]>('customModels', (record) => {
      const existing = record[providerId] ?? [];
      record[providerId] = existing.filter((id) => id !== modelId);
    });
    await this.refresh();
  }

  override dispose(): void {
    super.dispose();
    this._providers$.complete();
    this._probing.clear();
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
    const [userProviders, disabled, capabilities] = await Promise.all([
      this._loadUserProviders(),
      this._loadDisabled(),
      this._loadRecord('providerCapabilities') as Promise<Record<string, IACPProviderCapabilities>>,
    ]);
    const disabledSet = new Set(disabled);
    const all = [...ACP_PROVIDER_CATALOG, ...userProviders];

    const statuses = await Promise.all(
      all.map(async (descriptor): Promise<IACPProviderStatus> => {
        const availability = await probeProviderAvailability(
          descriptor.command,
          this._shellEnv,
          { probeTimeoutMs }
        );
        const cached = capabilities[descriptor.id];
        return {
          descriptor,
          availability,
          enabled: !disabledSet.has(descriptor.id),
          capabilities: cached ? await this._withCustomModels(descriptor.id, cached) : undefined,
        };
      })
    );

    this._providers$.next(statuses);
  }

  /** Merges hand-added ids into a probed model list without duplicating them. */
  private async _withCustomModels(
    providerId: string,
    capabilities: IACPProviderCapabilities
  ): Promise<IACPProviderCapabilities> {
    const record = await this._loadRecord('customModels') as Record<string, string[]>;
    const custom = record[providerId] ?? [];
    if (custom.length === 0) {
      return capabilities;
    }
    const known = new Set(capabilities.models.map((m) => m.id));
    return {
      ...capabilities,
      models: [
        ...capabilities.models,
        ...custom.filter((id) => !known.has(id)).map((id) => ({ id, name: id, custom: true })),
      ],
    };
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

  private async _loadDisabled(): Promise<string[]> {
    const stored = await this._configRepository.getField<string[]>(
      ACP_PLUGIN_CONFIG_KEY,
      'disabledProviders'
    );
    return Array.isArray(stored) ? stored : [];
  }

  private async _loadRecord(field: RecordField): Promise<Record<string, unknown>> {
    const stored = await this._configRepository.getField<Record<string, unknown>>(
      ACP_PLUGIN_CONFIG_KEY,
      field
    );
    return stored && typeof stored === 'object' ? stored : {};
  }

  private async _patchRecord<T>(
    field: RecordField,
    patch: (record: Record<string, T>) => void
  ): Promise<void> {
    const record = (await this._loadRecord(field)) as Record<string, T>;
    patch(record);
    await this._persistRaw(field, record);
  }

  /**
   * Persisted fields live as subKeys under the single plugin config key, and the
   * in-memory config is kept in sync so synchronous readers see the same value.
   */
  private async _persist<K extends keyof IACPPluginConfig>(
    field: K,
    value: IACPPluginConfig[K]
  ): Promise<void> {
    await this._persistRaw(field, value);
  }

  private async _persistRaw(field: keyof IACPPluginConfig, value: unknown): Promise<void> {
    await this._configRepository.setField(ACP_PLUGIN_CONFIG_KEY, field, value);
    const cfg = this._configService.getConfig<IACPPluginConfig>(ACP_PLUGIN_CONFIG_KEY) ?? {};
    this._configService.setConfig(ACP_PLUGIN_CONFIG_KEY, { ...cfg, [field]: value });
  }
}
