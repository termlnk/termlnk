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
import type { IMobilePreferencesService } from '@termlnk/database-mobile';
import type { IProviderSyncRepository } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type { IMobileModelConfig, IMobileProviderConfig, IMobileProviderGroup } from '../models/provider';
import { createIdentifier, Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { generateId, IMobilePreferencesService as IMobilePreferencesServiceId } from '@termlnk/database-mobile';
import { IProviderSyncRepository as IProviderSyncRepoId } from '@termlnk/sync';
import { deleteItemAsync, getItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { KNOWN_PROVIDER_TEMPLATES } from '../models/provider';

export interface IMobileProviderService {
  readonly providers$: Observable<readonly IMobileProviderGroup[]>;
  readonly activeModelId$: Observable<string | null>;
  readonly activeModel$: Observable<IMobileModelConfig | null>;

  initialize(): Promise<void>;
  addProvider(config: Omit<IMobileProviderConfig, 'id'>): Promise<string>;
  removeProvider(providerId: string): Promise<void>;
  updateProvider(providerId: string, patch: Partial<IMobileProviderConfig>): Promise<void>;
  getProviderConfig(providerId: string): IMobileProviderConfig | null;

  setApiKey(providerId: string, key: string): Promise<void>;
  getApiKey(providerId: string): Promise<string | null>;
  clearApiKey(providerId: string): Promise<void>;

  setActiveModel(modelId: string): void;
  getActiveModel(): IMobileModelConfig | null;

  toggleModel(providerId: string, modelId: string, enabled: boolean): Promise<void>;
  refreshProviderModels(providerId: string): Promise<void>;
  testProvider(providerId: string, modelId: string): Promise<{ latencyMs: number }>;
}

export const IMobileProviderService = createIdentifier<IMobileProviderService>('mobile.provider.service');

export class MobileProviderService extends Disposable implements IMobileProviderService {
  private readonly _providers$ = new BehaviorSubject<readonly IMobileProviderGroup[]>([]);
  readonly providers$: Observable<readonly IMobileProviderGroup[]> = this._providers$.asObservable();

  private readonly _activeModelId$ = new BehaviorSubject<string | null>(null);
  readonly activeModelId$: Observable<string | null> = this._activeModelId$.asObservable();

  readonly activeModel$: Observable<IMobileModelConfig | null>;

  private _initPromise: Promise<void> | null = null;

  private readonly _providerRepo: IProviderSyncRepository;
  private readonly _prefs: IMobilePreferencesService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IProviderSyncRepoId) providerRepo: IProviderSyncRepository,
    @Inject(IMobilePreferencesServiceId) prefs: IMobilePreferencesService,
    @Inject(ILogServiceId) logService: ILogService
  ) {
    super();
    this._providerRepo = providerRepo;
    this._prefs = prefs;
    this._logService = logService;

    this.activeModel$ = combineLatest([this._providers$, this._activeModelId$]).pipe(
      map(([groups, activeId]) => {
        if (!activeId) {
          return null;
        }
        for (const group of groups) {
          if (!group.provider.enabled) {
            continue;
          }
          for (const model of group.models) {
            if (model.id === activeId && model.enabled) {
              return model;
            }
          }
        }
        return null;
      })
    );

    this.disposeWithMe(
      this._providerRepo.changed$.subscribe(() => {
        void this._rebuild();
      })
    );
  }

  override dispose(): void {
    super.dispose();
    this._providers$.complete();
    this._activeModelId$.complete();
  }

  async initialize(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = this._init();
    }
    return this._initPromise;
  }

  async addProvider(config: Omit<IMobileProviderConfig, 'id'>): Promise<string> {
    await this.initialize();
    const id = generateId();
    await this._providerRepo.upsertProvider({
      id,
      name: config.name,
      enabled: config.enabled,
      builtin: config.builtin,
      api: config.api,
      baseUrl: config.baseUrl ?? null,
      headers: config.headers ? JSON.stringify(config.headers) : null,
      sort: config.sort,
    } as never);
    return id;
  }

  async removeProvider(providerId: string): Promise<void> {
    await this.initialize();
    await this._providerRepo.deleteProvider(providerId);
  }

  async updateProvider(providerId: string, patch: Partial<IMobileProviderConfig>): Promise<void> {
    await this.initialize();
    const existing = await this._providerRepo.getProviderById(providerId);
    if (!existing) {
      return;
    }
    const row = existing as unknown as Record<string, unknown>;
    await this._providerRepo.upsertProvider({
      id: providerId,
      name: patch.name ?? row.name,
      enabled: patch.enabled ?? row.enabled,
      builtin: row.builtin,
      api: row.api,
      apiKey: row.apiKey,
      baseUrl: patch.baseUrl !== undefined ? (patch.baseUrl ?? null) : row.baseUrl,
      headers: patch.headers !== undefined
        ? (patch.headers ? JSON.stringify(patch.headers) : null)
        : row.headers,
      sort: patch.sort ?? row.sort,
    } as never);
  }

  getProviderConfig(providerId: string): IMobileProviderConfig | null {
    const group = this._providers$.getValue().find((g) => g.provider.id === providerId);
    return group?.provider ?? null;
  }

  async setApiKey(providerId: string, key: string): Promise<void> {
    await this.initialize();
    const existing = await this._providerRepo.getProviderById(providerId);
    if (!existing) {
      return;
    }
    const row = existing as unknown as Record<string, unknown>;
    await this._providerRepo.upsertProvider({
      ...row,
      apiKey: key,
    } as never);
  }

  async getApiKey(providerId: string): Promise<string | null> {
    await this.initialize();
    const existing = await this._providerRepo.getProviderById(providerId);
    if (!existing) {
      return null;
    }
    return (existing as unknown as Record<string, unknown>).apiKey as string | null;
  }

  async clearApiKey(providerId: string): Promise<void> {
    await this.setApiKey(providerId, '');
  }

  setActiveModel(modelId: string): void {
    this._activeModelId$.next(modelId);
    void this._prefs.ready().then(() => {
      void this._prefs.update({ aiActiveModelId: modelId });
    });
  }

  getActiveModel(): IMobileModelConfig | null {
    const activeId = this._activeModelId$.getValue();
    if (!activeId) {
      return null;
    }
    for (const group of this._providers$.getValue()) {
      if (!group.provider.enabled) {
        continue;
      }
      for (const model of group.models) {
        if (model.id === activeId && model.enabled) {
          return model;
        }
      }
    }
    return null;
  }

  async refreshProviderModels(providerId: string): Promise<void> {
    await this.initialize();
    const provider = this.getProviderConfig(providerId);
    if (!provider) {
      return;
    }

    if (!provider.baseUrl) {
      throw new Error('Provider has no base URL configured');
    }

    const apiKey = await this.getApiKey(providerId);
    if (!apiKey) {
      throw new Error('No API key configured for this provider');
    }

    let modelIds: string[] = [];

    if (provider.api === 'openai-completions') {
      modelIds = await this._fetchOpenAIModels(provider.baseUrl, apiKey, provider.headers);
    } else if (provider.api === 'anthropic-messages') {
      modelIds = await this._fetchAnthropicModels(provider.baseUrl, apiKey, provider.headers);
    }

    const existingConfigs = await this._providerRepo.getAllModelConfigs();
    const existingIds = new Set(
      (existingConfigs as unknown as Array<{ providerId: string; modelId: string; id: string }>)
        .filter((m) => m.providerId === providerId)
        .map((m) => m.modelId)
    );

    for (const modelId of modelIds) {
      if (!existingIds.has(modelId)) {
        const fullId = `${providerId}/${modelId}`;
        await this._providerRepo.upsertModelConfig({
          id: fullId,
          providerId,
          modelId,
          enabled: false,
        } as never);
      }
    }
  }

  async toggleModel(providerId: string, modelId: string, enabled: boolean): Promise<void> {
    await this.initialize();
    const fullId = `${providerId}/${modelId}`;
    const allConfigs = await this._providerRepo.getAllModelConfigs();
    interface IToggleModelRow { id: string; providerId: string; modelId: string; enabled: boolean; overrides?: string | Record<string, unknown> }
    const row = (allConfigs as unknown as IToggleModelRow[]).find((m) => m.id === fullId);
    if (!row) {
      return;
    }
    await this._providerRepo.upsertModelConfig({
      ...row,
      enabled,
    } as never);
  }

  async testProvider(providerId: string, modelId: string): Promise<{ latencyMs: number }> {
    const provider = this.getProviderConfig(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    if (!provider.baseUrl) {
      throw new Error('Provider has no base URL configured');
    }

    const apiKey = await this.getApiKey(providerId);
    if (!apiKey) {
      throw new Error('No API key configured');
    }

    const start = Date.now();
    const messages = [{ role: 'user', content: 'hi' }];

    if (provider.api === 'openai-completions') {
      const resp = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          ...provider.headers,
        },
        body: JSON.stringify({ model: modelId, messages, max_tokens: 16 }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
    } else if (provider.api === 'anthropic-messages') {
      const resp = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          ...provider.headers,
        },
        body: JSON.stringify({ model: modelId, messages, max_tokens: 16 }),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
    }

    return { latencyMs: Date.now() - start };
  }

  private async _init(): Promise<void> {
    await this._prefs.ready();

    const existing = await this._providerRepo.getProviders();
    if (existing.length === 0) {
      await this._seedBuiltinProviders();
    }

    await this._migrateOldConfig();

    const savedModelId = (this._prefs.get() as unknown as Record<string, unknown>).aiActiveModelId as string | undefined;
    if (savedModelId) {
      this._activeModelId$.next(savedModelId);
    }

    await this._rebuild();
  }

  private async _seedBuiltinProviders(): Promise<void> {
    for (let i = 0; i < KNOWN_PROVIDER_TEMPLATES.length; i++) {
      const template = KNOWN_PROVIDER_TEMPLATES[i];

      await this._providerRepo.upsertProvider({
        id: template.id,
        name: template.name,
        enabled: false,
        builtin: true,
        api: template.api,
        baseUrl: template.defaultBaseUrl ?? null,
        sort: i,
      } as never);

      for (const modelSeed of template.models) {
        const fullId = `${template.id}/${modelSeed.modelId}`;
        await this._providerRepo.upsertModelConfig({
          id: fullId,
          providerId: template.id,
          modelId: modelSeed.modelId,
          enabled: false,
          overrides: JSON.stringify({
            name: modelSeed.name,
            reasoning: modelSeed.reasoning,
            contextWindow: modelSeed.contextWindow,
            maxTokens: modelSeed.maxTokens,
          }),
        } as never);
      }
    }
    this._logService.debug('[MobileProviderService] Seeded builtin providers.');
  }

  private async _migrateOldConfig(): Promise<void> {
    const oldKey = await getItemAsync('termlnk.mobile.ai-api-key', { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    if (!oldKey) {
      return;
    }

    const prefs = this._prefs.get() as unknown as Record<string, unknown>;
    const oldBaseUrl = (prefs.aiBaseUrl as string) || 'https://api.openai.com/v1';
    const oldModel = (prefs.aiModel as string) || 'gpt-4o-mini';

    const normalizedOldUrl = oldBaseUrl.replace(/\/+$/, '');
    const matchingTemplate = KNOWN_PROVIDER_TEMPLATES.find((t) => t.defaultBaseUrl && normalizedOldUrl === t.defaultBaseUrl.replace(/\/+$/, ''));

    if (matchingTemplate) {
      await this.setApiKey(matchingTemplate.id, oldKey);
      this.setActiveModel(`${matchingTemplate.id}/${oldModel}`);
    } else {
      const id = await this.addProvider({
        name: 'Migrated Provider',
        enabled: true,
        builtin: false,
        api: 'openai-completions',
        baseUrl: oldBaseUrl,
        sort: 100,
      });
      await this.setApiKey(id, oldKey);
      await this._providerRepo.upsertModelConfig({
        id: `${id}/${oldModel}`,
        providerId: id,
        modelId: oldModel,
        enabled: true,
      } as never);
      this.setActiveModel(`${id}/${oldModel}`);
    }

    await deleteItemAsync('termlnk.mobile.ai-api-key', { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY }).catch(() => {});
    this._logService.debug('[MobileProviderService] Migrated old AI config.');
  }

  private async _rebuild(): Promise<void> {
    const providerRows = await this._providerRepo.getProviders();
    const modelConfigRows = await this._providerRepo.getAllModelConfigs();

    interface IRebuildProviderRow { id: string; name: string; enabled: boolean; builtin: boolean; api: string; baseUrl?: string; headers?: string | Record<string, string>; sort: number }
    interface IRebuildModelRow { id: string; providerId: string; modelId: string; enabled: boolean; overrides?: string | Record<string, unknown> }

    const modelsByProvider = new Map<string, IRebuildModelRow[]>();
    for (const row of modelConfigRows as unknown as IRebuildModelRow[]) {
      const list = modelsByProvider.get(row.providerId) ?? [];
      list.push(row);
      modelsByProvider.set(row.providerId, list);
    }

    const groups: IMobileProviderGroup[] = (providerRows as unknown as IRebuildProviderRow[])
      .sort((a, b) => a.sort - b.sort)
      .map((row) => {
        const provider: IMobileProviderConfig = {
          id: row.id,
          name: row.name,
          enabled: row.enabled,
          builtin: row.builtin,
          api: row.api as IMobileProviderConfig['api'],
          baseUrl: row.baseUrl || this._getDefaultBaseUrl(row.id),
          headers: typeof row.headers === 'string' ? JSON.parse(row.headers) as Record<string, string> : row.headers ?? undefined,
          sort: row.sort,
        };

        const modelRows = modelsByProvider.get(row.id) ?? [];
        const models: IMobileModelConfig[] = modelRows.map((m) => {
          const overrides = typeof m.overrides === 'string' ? JSON.parse(m.overrides) as Record<string, unknown> : m.overrides ?? {};
          return {
            id: m.id,
            providerId: m.providerId,
            modelId: m.modelId,
            name: (overrides.name as string) || m.modelId,
            enabled: m.enabled,
            reasoning: (overrides.reasoning as boolean) ?? false,
            contextWindow: (overrides.contextWindow as number) ?? 128_000,
            maxTokens: (overrides.maxTokens as number) ?? 8_192,
          };
        });

        return { provider, models };
      });

    this._providers$.next(groups);
  }

  private _getDefaultBaseUrl(providerId: string): string | undefined {
    return KNOWN_PROVIDER_TEMPLATES.find((t) => t.id === providerId)?.defaultBaseUrl;
  }

  private async _fetchOpenAIModels(baseUrl: string, apiKey: string, headers?: Record<string, string>): Promise<string[]> {
    const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { authorization: `Bearer ${apiKey}`, ...headers },
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch models: HTTP ${resp.status}`);
    }
    const json = await resp.json() as { data?: Array<{ id: string }> };
    return (json.data ?? [])
      .map((m) => m.id)
      .filter((id) => id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4') || id.startsWith('chatgpt-'))
      .sort();
  }

  private async _fetchAnthropicModels(baseUrl: string, apiKey: string, headers?: Record<string, string>): Promise<string[]> {
    try {
      const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/models`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...headers },
      });
      if (!resp.ok) {
        return [];
      }
      const json = await resp.json() as { data?: Array<{ id: string }> };
      return (json.data ?? []).map((m) => m.id).sort();
    } catch {
      return [];
    }
  }
}
