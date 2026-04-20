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

import type { Api, KnownProvider, Model } from '@mariozechner/pi-ai';
import type { ICustomModelDefinition, ILLMProvider, ILLMProviderService, IModelOption, IModelOverrides, IModelUserConfig, IProviderGroup, IProviderUserConfig } from '@termlnk/agent';
import type { IAICustomModelEntity, IAIProviderEntity, IAIProviderModelEntity } from '@termlnk/database';
import type { Observable } from 'rxjs';
import { getModels, getProviders } from '@mariozechner/pi-ai';
import { AGENT_PLUGIN_CONFIG_KEY, AI_STORAGE_PROVIDERS_KEY } from '@termlnk/agent';
import { Disposable, Inject } from '@termlnk/core';
import { ConfigRepository, ProviderRepository } from '@termlnk/database';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { applyModelOverride, buildModelFromCustomDef, toModelOption } from './utils';

const MODEL_SYNC_TIMEOUT_MS = 12000;

const DEFAULT_PROVIDER_BASE_URL: Record<string, string> = {
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  huggingface: 'https://router.huggingface.co/v1',
  'vercel-ai-gateway': 'https://ai-gateway.vercel.sh',
};

const PROVIDER_DISPLAY_NAME: Record<string, string> = {
  aihubmix: 'AiHubMix',
  'amazon-bedrock': 'Amazon Bedrock',
  'azure-openai-responses': 'Azure OpenAI',
  deepseek: 'DeepSeek',
  'github-copilot': 'GitHub Copilot',
  google: 'Google Gemini',
  'google-antigravity': 'Google Antigravity',
  'google-gemini-cli': 'Google Gemini CLI',
  'google-vertex': 'Google Vertex AI',
  'kimi-coding': 'Moonshot',
  minimax: 'MiniMax',
  'minimax-cn': 'MiniMax CN',
  openai: 'OpenAI',
  'openai-codex': 'OpenAI Codex',
  openrouter: 'OpenRouter',
  xai: 'xAI',
  zai: 'Z.AI Coding Plan',
};

const DEFAULT_PROVIDER_SORT: Record<string, number> = {
  anthropic: 1,
  openai: 2,
  google: 3,
  deepseek: 4,
  xai: 5,
  groq: 6,
  openrouter: 7,
  mistral: 8,
};

const UNSUPPORTED_MODEL_SYNC_PROVIDERS = new Set([
  'amazon-bedrock',
  'azure-openai-responses',
  'github-copilot',
  'google-antigravity',
  'google-gemini-cli',
  'google-vertex',
  'openai-codex',
  'opencode',
  'kimi-coding',
  'zai',
  'minimax',
  'minimax-cn',
]);

interface IModelListResponse {
  data?: Array<{ id?: string }>;
}

interface IGoogleModelListResponse {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  nextPageToken?: string;
}

// Legacy type for migration
interface ILegacyProviderConfig {
  provider: string;
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
}

export class LLMProviderService extends Disposable implements ILLMProviderService {
  // Runtime cache
  private _builtProviders: ILLMProvider[] = [];
  private _providerConfigs = new Map<string, IProviderUserConfig>();
  private _providerUpdateQueue = new Map<string, Promise<void>>();
  private _modelConfigs = new Map<string, IModelUserConfig>();
  private _customModels: IAICustomModelEntity[] = [];
  private _initialized = false;

  // Observables
  private readonly _providers$ = new BehaviorSubject<IProviderGroup[]>([]);
  readonly providers$: Observable<IProviderGroup[]> = this._providers$.asObservable();

  private readonly _activeModelId$ = new BehaviorSubject<string | null>(null);
  readonly activeModelId$: Observable<string | null> = this._activeModelId$.asObservable();

  readonly activeModel$: Observable<IModelOption | null> = combineLatest([
    this._providers$,
    this._activeModelId$,
  ]).pipe(
    map(([providers, modelId]) => {
      if (!modelId) return null;
      for (const provider of providers) {
        const model = provider.models.find((m) => m.id === modelId);
        if (model) return model;
      }
      return null;
    })
  );

  readonly activeProvider$: Observable<IProviderUserConfig | null> = combineLatest([
    this._providers$,
    this.activeModel$,
  ]).pipe(
    map(([_providers, model]) => {
      if (!model) return null;
      return this._providerConfigs.get(model.providerId) ?? null;
    })
  );

  constructor(
    @Inject(ProviderRepository) private readonly _providerRepository: ProviderRepository,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository
  ) {
    super();

    this.disposeWithMe(
      this._providerRepository.changed$.subscribe(() => {
        if (this._initialized) {
          this._reloadAndRebuild();
        }
      })
    );

    this.initialize();
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      await this._migrateFromLegacy();
    } catch (error) {
      console.error('[LLMProviderService] Legacy migration failed:', error);
    }

    try {
      await this._loadFromDatabase();
    } catch (error) {
      console.error('[LLMProviderService] Failed to load from database:', error);
    }

    this._rebuildAndPublish();

    try {
      const activeModelId = await this._configRepository.getField<string>(AGENT_PLUGIN_CONFIG_KEY, 'activeModel');
      if (activeModelId && typeof activeModelId === 'string') {
        this._activeModelId$.next(activeModelId);
      }
    } catch (error) {
      console.error('[LLMProviderService] Failed to load active model:', error);
    }

    this._initialized = true;
  }

  // ---------------------------------------------------------------------------
  // Provider operations
  // ---------------------------------------------------------------------------

  async addProvider(config: IProviderUserConfig): Promise<void> {
    this.ensureNotDisposed();

    await this._providerRepository.upsertProvider({
      id: config.providerId,
      name: config.name ?? config.providerId,
      enabled: config.enabled,
      builtin: false,
      api: config.api as string ?? 'openai-completions',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      headers: config.headers as any,
      sort: config.sort ?? 999,
    });

    this._providerConfigs.set(config.providerId, config);
    this._rebuildAndPublish();
  }

  async removeProvider(providerId: string): Promise<void> {
    this.ensureNotDisposed();

    await this._providerRepository.deleteProvider(providerId);
    this._providerConfigs.delete(providerId);
    this._rebuildAndPublish();

    const activeModelId = this._activeModelId$.getValue();
    if (activeModelId?.startsWith(`${providerId}/`)) {
      this._activeModelId$.next(null);
      this._persistActiveModel(null);
    }
  }

  async updateProviderConfig(providerId: string, patch: Partial<IProviderUserConfig>): Promise<void> {
    this.ensureNotDisposed();

    const previous = this._providerUpdateQueue.get(providerId) ?? Promise.resolve();
    const current = previous
      .catch(() => {})
      .then(async () => {
        await this._updateProviderConfigInternal(providerId, patch);
      });

    this._providerUpdateQueue.set(providerId, current);

    try {
      await current;
    } finally {
      if (this._providerUpdateQueue.get(providerId) === current) {
        this._providerUpdateQueue.delete(providerId);
      }
    }
  }

  private async _updateProviderConfigInternal(providerId: string, patch: Partial<IProviderUserConfig>): Promise<void> {
    const existing = this._providerConfigs.get(providerId);
    const updated: IProviderUserConfig = {
      providerId,
      name: patch.name ?? existing?.name,
      enabled: patch.enabled ?? existing?.enabled ?? false,
      api: patch.api ?? existing?.api,
      apiKey: patch.apiKey ?? existing?.apiKey,
      baseUrl: patch.baseUrl ?? existing?.baseUrl,
      headers: patch.headers ?? existing?.headers,
      sort: patch.sort ?? existing?.sort,
    };

    // Determine if this is a builtin provider
    const builtinProviders = new Set(getProviders());
    const isBuiltin = builtinProviders.has(providerId as KnownProvider);

    await this._providerRepository.upsertProvider({
      id: providerId,
      name: updated.name ?? this._formatProviderName(providerId),
      enabled: updated.enabled,
      builtin: isBuiltin,
      api: updated.api as string,
      apiKey: updated.apiKey,
      baseUrl: updated.baseUrl,
      headers: updated.headers as any,
      sort: updated.sort ?? (isBuiltin ? this._getDefaultSort(providerId) : 999),
    });

    this._providerConfigs.set(providerId, updated);
    this._rebuildAndPublish();

    if (updated.enabled === false) {
      const activeModelId = this._activeModelId$.getValue();
      if (activeModelId?.startsWith(`${providerId}/`)) {
        this._activeModelId$.next(null);
        this._persistActiveModel(null);
      }
    }
  }

  getProviderConfig(providerId: string): IProviderUserConfig | null {
    return this._providerConfigs.get(providerId) ?? null;
  }

  getProviders(): IProviderGroup[] {
    return this._providers$.getValue();
  }

  getAvailableModels(): IProviderGroup[] {
    return this._providers$.getValue().filter((p) => p.enabled);
  }

  // ---------------------------------------------------------------------------
  // Model operations
  // ---------------------------------------------------------------------------

  async refreshProviderModels(providerId: string): Promise<string[]> {
    this.ensureNotDisposed();

    const config = this._providerConfigs.get(providerId);
    const resolvedBaseUrl = config?.baseUrl ?? this._getDefaultBaseUrl(providerId);

    const modelIds = await this._fetchProviderModelIds(providerId, {
      apiKey: config?.apiKey,
      baseUrl: resolvedBaseUrl,
    });

    if (modelIds.length === 0) {
      throw new Error(`No models found for provider "${providerId}"`);
    }

    // Save fetched models as custom models for this provider
    const builtinProviders = new Set(getProviders());
    if (!builtinProviders.has(providerId as KnownProvider)) {
      for (const modelId of modelIds) {
        const compositeId = `${providerId}/${modelId}`;
        await this._providerRepository.upsertCustomModel({
          id: compositeId,
          providerId,
          modelId,
          name: modelId,
          api: config?.api as string,
          baseUrl: config?.baseUrl,
        });
      }
    }

    // Ensure provider config is updated with baseUrl
    if (resolvedBaseUrl && (!config?.baseUrl || config.baseUrl !== resolvedBaseUrl)) {
      await this.updateProviderConfig(providerId, { baseUrl: resolvedBaseUrl });
    }

    await this._reloadAndRebuild();
    return modelIds;
  }

  setActiveModel(modelId: string): void {
    this.ensureNotDisposed();
    this._activeModelId$.next(modelId);
    this._persistActiveModel(modelId);
  }

  getActiveModel(): IModelOption | null {
    const modelId = this._activeModelId$.getValue();
    if (!modelId) return null;
    for (const provider of this._providers$.getValue()) {
      const model = provider.models.find((m) => m.id === modelId);
      if (model) return model;
    }
    return null;
  }

  async toggleModel(providerId: string, modelId: string, enabled: boolean): Promise<void> {
    this.ensureNotDisposed();

    const compositeId = `${providerId}/${modelId}`;
    await this._providerRepository.upsertModelConfig({
      id: compositeId,
      providerId,
      modelId,
      enabled,
      overrides: this._modelConfigs.get(compositeId)?.overrides as any,
    });

    this._modelConfigs.set(compositeId, { providerId, modelId, enabled, overrides: this._modelConfigs.get(compositeId)?.overrides });
    this._rebuildAndPublish();
  }

  async updateModelOverrides(providerId: string, modelId: string, overrides: IModelOverrides): Promise<void> {
    this.ensureNotDisposed();

    const compositeId = `${providerId}/${modelId}`;
    const existing = this._modelConfigs.get(compositeId);
    await this._providerRepository.upsertModelConfig({
      id: compositeId,
      providerId,
      modelId,
      enabled: existing?.enabled ?? false,
      overrides: overrides as any,
    });

    this._modelConfigs.set(compositeId, { providerId, modelId, enabled: existing?.enabled ?? false, overrides });
    this._rebuildAndPublish();
  }

  async resetModelOverrides(providerId: string, modelId: string): Promise<void> {
    this.ensureNotDisposed();

    const compositeId = `${providerId}/${modelId}`;
    await this._providerRepository.deleteModelConfig(compositeId);
    this._modelConfigs.delete(compositeId);
    this._rebuildAndPublish();
  }

  // ---------------------------------------------------------------------------
  // Custom model operations
  // ---------------------------------------------------------------------------

  async addCustomModel(providerId: string, model: ICustomModelDefinition): Promise<void> {
    this.ensureNotDisposed();

    const compositeId = `${providerId}/${model.id}`;
    const providerConfig = this._providerConfigs.get(providerId);

    await this._providerRepository.upsertCustomModel({
      id: compositeId,
      providerId,
      modelId: model.id,
      name: model.name ?? model.id,
      api: (model.api ?? providerConfig?.api ?? 'openai-completions') as string,
      baseUrl: model.baseUrl ?? providerConfig?.baseUrl,
      reasoning: model.reasoning ?? false,
      inputModes: (model.input ?? ['text']) as any,
      cost: model.cost as any,
      contextWindow: model.contextWindow ?? 128000,
      maxTokens: model.maxTokens ?? 16384,
      headers: model.headers as any,
      compat: model.compat as any,
    });

    await this._reloadAndRebuild();
  }

  async removeCustomModel(providerId: string, modelId: string): Promise<void> {
    this.ensureNotDisposed();

    const compositeId = `${providerId}/${modelId}`;
    await this._providerRepository.deleteCustomModel(compositeId);
    await this._providerRepository.deleteModelConfig(compositeId);

    await this._reloadAndRebuild();

    const activeModelId = this._activeModelId$.getValue();
    if (activeModelId === compositeId) {
      this._activeModelId$.next(null);
      this._persistActiveModel(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Runtime Model<Api> resolution
  // ---------------------------------------------------------------------------

  resolveModel(providerId: string, modelId: string): Model<Api> | null {
    const provider = this._builtProviders.find((p) => p.id === providerId);
    return provider?.models.find((m) => m.id === modelId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  override dispose(): void {
    this._providers$.complete();
    this._activeModelId$.complete();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Core build logic
  // ---------------------------------------------------------------------------

  private _buildProviders(): ILLMProvider[] {
    const providerConfigs = this._providerConfigs;
    const modelConfigs = this._modelConfigs;
    const customModels = this._customModels;
    const providers: ILLMProvider[] = [];
    const processedProviderIds = new Set<string>();

    // 1. Built-in providers from pi-ai
    try {
      for (const providerName of getProviders()) {
        processedProviderIds.add(providerName);
        const userConfig = providerConfigs.get(providerName);

        let builtinModels: Model<Api>[];
        try {
          builtinModels = getModels(providerName as any) as Model<Api>[];
        } catch {
          builtinModels = [];
        }

        // Apply provider-level overrides
        let models = builtinModels.map((m) => {
          let model = m;
          if (userConfig?.baseUrl) {
            model = { ...model, baseUrl: userConfig.baseUrl };
          }
          if (userConfig?.headers) {
            model = { ...model, headers: { ...model.headers, ...userConfig.headers } };
          }
          return model;
        });

        // Apply model-level overrides
        models = models.map((model) => {
          const config = modelConfigs.get(`${providerName}/${model.id}`);
          if (config?.overrides) {
            return applyModelOverride(model, config.overrides);
          }
          return model;
        });

        // Merge custom models for this provider
        const providerCustomModels = customModels
          .filter((cm) => cm.providerId === providerName)
          .map((cm) => buildModelFromCustomDef(providerName, userConfig, this._entityToCustomDef(cm)));

        models = this._mergeCustomModels(models, providerCustomModels);

        providers.push({
          id: providerName,
          name: this._formatProviderName(providerName),
          enabled: userConfig?.enabled ?? false,
          builtin: true,
          api: builtinModels[0]?.api ?? 'openai-completions',
          apiKey: userConfig?.apiKey,
          baseUrl: userConfig?.baseUrl,
          headers: userConfig?.headers,
          sort: userConfig?.sort ?? this._getDefaultSort(providerName),
          models,
        });
      }
    } catch {
      // pi-ai unavailable, skip built-in providers
    }

    // 2. Custom providers (not in pi-ai)
    for (const [providerId, config] of providerConfigs) {
      if (processedProviderIds.has(providerId)) continue;

      const providerCustomModels = customModels
        .filter((cm) => cm.providerId === providerId)
        .map((cm) => buildModelFromCustomDef(providerId, config, this._entityToCustomDef(cm)));

      providers.push({
        id: providerId,
        name: config.name ?? this._formatProviderName(providerId),
        enabled: config.enabled,
        builtin: false,
        api: (config.api ?? 'openai-completions') as Api,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        headers: config.headers,
        sort: config.sort ?? 999,
        models: providerCustomModels,
      });
    }

    // Sort providers
    providers.sort((a, b) => a.sort - b.sort);

    return providers;
  }

  private _rebuildAndPublish(): void {
    this._builtProviders = this._buildProviders();

    const groups: IProviderGroup[] = this._builtProviders.map((provider) => ({
      id: provider.id,
      name: provider.name,
      enabled: provider.enabled,
      builtin: provider.builtin,
      api: provider.api,
      models: provider.models.map((model) => {
        const compositeId = `${provider.id}/${model.id}`;
        const modelConfig = this._modelConfigs.get(compositeId);
        const enabled = modelConfig?.enabled ?? false;
        return toModelOption(provider.id, model, enabled);
      }),
    }));

    this._providers$.next(groups);
  }

  // ---------------------------------------------------------------------------
  // Database loading
  // ---------------------------------------------------------------------------

  private async _loadFromDatabase(): Promise<void> {
    const [providerEntities, modelConfigEntities, customModelEntities] = await Promise.all([
      this._providerRepository.getProviders(),
      this._providerRepository.getAllModelConfigs(),
      this._providerRepository.getAllCustomModels(),
    ]);

    this._providerConfigs.clear();
    for (const entity of providerEntities) {
      this._providerConfigs.set(entity.id, this._entityToProviderConfig(entity));
    }

    this._modelConfigs.clear();
    for (const entity of modelConfigEntities) {
      this._modelConfigs.set(entity.id, this._entityToModelConfig(entity));
    }

    this._customModels = customModelEntities;
  }

  private async _reloadAndRebuild(): Promise<void> {
    await this._loadFromDatabase();
    this._rebuildAndPublish();
  }

  // ---------------------------------------------------------------------------
  // Entity conversion helpers
  // ---------------------------------------------------------------------------

  private _entityToProviderConfig(entity: IAIProviderEntity): IProviderUserConfig {
    return {
      providerId: entity.id,
      name: entity.name,
      enabled: entity.enabled,
      api: entity.api as Api | undefined,
      apiKey: entity.apiKey ?? undefined,
      baseUrl: entity.baseUrl ?? undefined,
      headers: entity.headers as Record<string, string> | undefined,
      sort: entity.sort,
    };
  }

  private _entityToModelConfig(entity: IAIProviderModelEntity): IModelUserConfig {
    return {
      providerId: entity.providerId,
      modelId: entity.modelId,
      enabled: entity.enabled,
      overrides: entity.overrides as IModelOverrides | undefined,
    };
  }

  private _entityToCustomDef(entity: IAICustomModelEntity): ICustomModelDefinition {
    return {
      id: entity.modelId,
      name: entity.name,
      api: entity.api as Api | undefined,
      baseUrl: entity.baseUrl ?? undefined,
      reasoning: entity.reasoning,
      input: entity.inputModes as ('text' | 'image')[],
      cost: entity.cost as Model<Api>['cost'] | undefined,
      contextWindow: entity.contextWindow,
      maxTokens: entity.maxTokens,
      headers: entity.headers as Record<string, string> | undefined,
      compat: entity.compat as Model<Api>['compat'],
    };
  }

  // ---------------------------------------------------------------------------
  // Legacy migration
  // ---------------------------------------------------------------------------

  private async _migrateFromLegacy(): Promise<void> {
    try {
      const legacyProviders = await this._configRepository.get<ILegacyProviderConfig[]>(AI_STORAGE_PROVIDERS_KEY);
      if (!legacyProviders || !Array.isArray(legacyProviders) || legacyProviders.length === 0) {
        return;
      }

      const builtinProviders = new Set(getProviders());

      for (const legacy of legacyProviders) {
        const isBuiltin = builtinProviders.has(legacy.provider as KnownProvider);

        await this._providerRepository.upsertProvider({
          id: legacy.provider,
          name: this._formatProviderName(legacy.provider),
          enabled: legacy.enabled ?? false,
          builtin: isBuiltin,
          api: null,
          apiKey: legacy.apiKey,
          baseUrl: legacy.baseUrl,
          headers: null,
          sort: isBuiltin ? this._getDefaultSort(legacy.provider) : 999,
        });

        // If legacy had model IDs and it's not a built-in provider, create custom models
        if (legacy.models && legacy.models.length > 0 && !isBuiltin) {
          for (const modelId of legacy.models) {
            await this._providerRepository.upsertCustomModel({
              id: `${legacy.provider}/${modelId}`,
              providerId: legacy.provider,
              modelId,
              name: modelId,
            });
          }
        }
      }

      // Delete legacy keys after successful migration
      await this._configRepository.delete(AI_STORAGE_PROVIDERS_KEY).catch(() => {});
    } catch {
      // Migration is best-effort
    }
  }

  // ---------------------------------------------------------------------------
  // Model sync (HTTP)
  // ---------------------------------------------------------------------------

  private async _fetchProviderModelIds(providerId: string, config: { apiKey?: string; baseUrl?: string }): Promise<string[]> {
    if (UNSUPPORTED_MODEL_SYNC_PROVIDERS.has(providerId)) {
      throw new Error(`Provider "${providerId}" requires specialized auth and cannot be auto-synced yet.`);
    }

    if (providerId === 'anthropic') {
      return this._fetchAnthropicModelIds(config.apiKey, config.baseUrl);
    }

    if (providerId === 'google') {
      return this._fetchGoogleModelIds(config.apiKey, config.baseUrl);
    }

    return this._fetchOpenAICompatibleModelIds(providerId, config.apiKey, config.baseUrl);
  }

  private async _fetchOpenAICompatibleModelIds(providerId: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    const resolvedApiKey = this._requireApiKey(providerId, apiKey);
    const modelsUrl = this._resolveModelsUrl(providerId, baseUrl, this._getDefaultBaseUrl(providerId));

    const response = await this._fetchJson<IModelListResponse>(modelsUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${resolvedApiKey}` },
    });

    return this._normalizeModelIds(
      (response.data ?? []).map((model) => model.id ?? '').filter(Boolean)
    );
  }

  private async _fetchAnthropicModelIds(apiKey?: string, baseUrl?: string): Promise<string[]> {
    const resolvedApiKey = this._requireApiKey('anthropic', apiKey);
    const modelsUrl = this._resolveModelsUrl('anthropic', baseUrl, this._getDefaultBaseUrl('anthropic'));

    const response = await this._fetchJson<IModelListResponse>(modelsUrl, {
      method: 'GET',
      headers: {
        'x-api-key': resolvedApiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    return this._normalizeModelIds(
      (response.data ?? []).map((model) => model.id ?? '').filter(Boolean)
    );
  }

  private async _fetchGoogleModelIds(apiKey?: string, baseUrl?: string): Promise<string[]> {
    const resolvedApiKey = this._requireApiKey('google', apiKey);
    const resolvedBaseUrl = baseUrl || this._getDefaultBaseUrl('google');
    if (!resolvedBaseUrl) {
      throw new Error('Provider "google" needs a Base URL before syncing models.');
    }
    const normalizedBaseUrl = this._normalizeBaseUrl(resolvedBaseUrl);
    const modelIds = new Set<string>();
    let pageToken: string | undefined;

    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({ key: resolvedApiKey, pageSize: '200' });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await this._fetchJson<IGoogleModelListResponse>(`${normalizedBaseUrl}/models?${params.toString()}`, {
        method: 'GET',
      });

      for (const model of response.models ?? []) {
        const supportedMethods = model.supportedGenerationMethods ?? [];
        if (supportedMethods.length > 0 && !supportedMethods.includes('generateContent')) continue;

        const rawName = model.name ?? '';
        const id = rawName.replace(/^models\//, '').trim();
        if (id) modelIds.add(id);
      }

      if (!response.nextPageToken) break;
      pageToken = response.nextPageToken;
    }

    return this._normalizeModelIds([...modelIds]);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _mergeCustomModels(builtinModels: Model<Api>[], customModels: Model<Api>[]): Model<Api>[] {
    const result = [...builtinModels];
    for (const custom of customModels) {
      const existingIndex = result.findIndex((m) => m.id === custom.id);
      if (existingIndex >= 0) {
        result[existingIndex] = custom; // Custom overrides built-in
      } else {
        result.push(custom);
      }
    }
    return result;
  }

  private _resolveModelsUrl(providerId: string, baseUrl: string | undefined, fallbackBaseUrl: string | undefined): string {
    const sourceBaseUrl = baseUrl?.trim() || fallbackBaseUrl;
    if (!sourceBaseUrl) {
      throw new Error(`Provider "${providerId}" needs a Base URL before syncing models.`);
    }
    const normalizedBaseUrl = this._normalizeBaseUrl(sourceBaseUrl);
    return normalizedBaseUrl.endsWith('/models') ? normalizedBaseUrl : `${normalizedBaseUrl}/models`;
  }

  private _getDefaultBaseUrl(providerId: string): string | undefined {
    const mapped = DEFAULT_PROVIDER_BASE_URL[providerId];
    if (mapped) return mapped;

    try {
      const models = getModels(providerId as any);
      const candidate = models.find((model: any) => typeof model?.baseUrl === 'string' && model.baseUrl.trim().length > 0)?.baseUrl;
      return candidate ? this._normalizeBaseUrl(candidate) : undefined;
    } catch {
      return undefined;
    }
  }

  private _getDefaultSort(providerId: string): number {
    return DEFAULT_PROVIDER_SORT[providerId] ?? 50;
  }

  private _normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private _requireApiKey(providerId: string, apiKey?: string): string {
    const value = apiKey?.trim();
    if (!value) {
      throw new Error(`Provider "${providerId}" requires an API key before syncing models.`);
    }
    return value;
  }

  private async _fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MODEL_SYNC_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${message.slice(0, 200)}`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private _normalizeModelIds(modelIds: string[]): string[] {
    const deduped = new Set<string>();
    for (const modelId of modelIds) {
      const normalized = modelId.trim();
      if (normalized) deduped.add(normalized);
    }
    return [...deduped].sort((a, b) => a.localeCompare(b));
  }

  private _formatProviderName(name: string): string {
    const normalized = name.trim().toLowerCase();
    const mapped = PROVIDER_DISPLAY_NAME[normalized];
    if (mapped) return mapped;

    return name
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private _persistActiveModel(modelId: string | null): void {
    if (modelId) {
      this._configRepository.setField(AGENT_PLUGIN_CONFIG_KEY, 'activeModel', modelId).catch(() => {});
    } else {
      this._configRepository.deleteField(AGENT_PLUGIN_CONFIG_KEY, 'activeModel').catch(() => {});
    }
  }
}
