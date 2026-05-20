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

import type { IModelOption } from '@termlnk/agent';
import { compareProviders, getDefaultProviderBaseUrl } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, cn, Input, Popover, PopoverContent, PopoverTrigger, Switch, useDependency, useObservable } from '@termlnk/design';
import { IProviderConfigService } from '@termlnk/rpc-client';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Search, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddCustomModelDialog } from './AddCustomModelDialog';
import { AddProviderDialog } from './AddProviderDialog';
import { ModelConfigPanel } from './ModelConfigPanel';
import { ModelListItem } from './ModelListItem';
import { ProviderLogo } from './provider-logo';

const panelCls = 'tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/70';
const sectionCls = 'tm:rounded-xl tm:border tm:border-line tm:bg-black/20 tm:p-4';
const labelCls = 'tm:text-xs tm:font-medium tm:text-white';
const inputCls = 'tm:h-8 tm:text-xs';

interface IProviderListItem {
  id: string;
  name: string;
  modelCount: number;
  enabledModelCount: number;
  isEnabled: boolean;
  hasApiKey: boolean;
  isBuiltin: boolean;
}

export function AiProviderTab() {
  const localeService = useDependency(LocaleService);
  const providerConfigService = useDependency(IProviderConfigService);
  const providers = useObservable(providerConfigService.providers$, []);

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  // Seeded from server with the plaintext apiKey so the Input's password-eye toggle can
  // reveal it; empty submission means "unchanged" (main-process smart-merge).
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [baseUrlInputs, setBaseUrlInputs] = useState<Record<string, string>>({});
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ providerId: string; type: 'success' | 'error'; message: string } | null>(null);
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testModelQuery, setTestModelQuery] = useState('');
  const [testPopoverOpen, setTestPopoverOpen] = useState(false);
  const testRequestSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadConfigs = async () => {
      const entries = await Promise.all(
        providers.map(async (provider) => {
          const config = await providerConfigService.getProviderConfig(provider.id);
          return [provider.id, config] as const;
        })
      );

      if (cancelled) return;

      const apiKeys: Record<string, string> = {};
      const baseUrls: Record<string, string> = {};

      for (const [providerId, config] of entries) {
        if (!config) {
          continue;
        }
        if (config.apiKey) {
          apiKeys[providerId] = config.apiKey;
        }
        if (config.baseUrl) {
          baseUrls[providerId] = config.baseUrl;
        }
      }

      setApiKeyInputs((prev) => ({ ...apiKeys, ...prev }));
      setBaseUrlInputs((prev) => ({ ...baseUrls, ...prev }));
    };

    void loadConfigs();
    return () => {
      cancelled = true;
    };
  }, [providers, providerConfigService]);

  useEffect(() => {
    const orderedProviders = providers.toSorted(compareProviders);

    setSelectedProviderId((prev) => {
      if (prev && orderedProviders.some((p) => p.id === prev)) return prev;
      return orderedProviders[0]?.id ?? null;
    });
  }, [providers]);

  const providerList = useMemo<IProviderListItem[]>(() => {
    const query = providerQuery.trim().toLowerCase();

    return providers
      .map((provider) => ({
        id: provider.id,
        name: provider.name,
        modelCount: provider.models.length,
        enabledModelCount: provider.models.filter((m) => m.enabled).length,
        isEnabled: provider.enabled,
        hasApiKey: !!apiKeyInputs[provider.id],
        isBuiltin: provider.builtin,
      }))
      .filter((provider) => {
        if (!query) return true;
        return provider.name.toLowerCase().includes(query) || provider.id.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        // Enabled providers come first
        if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1;
        return compareProviders(a, b);
      });
  }, [providers, providerQuery, apiKeyInputs]);

  const selectedProvider = useMemo(() => {
    return providers.find((p) => p.id === selectedProviderId) ?? null;
  }, [providers, selectedProviderId]);

  const filteredModels = useMemo<IModelOption[]>(() => {
    if (!selectedProvider) return [];
    const query = modelQuery.trim().toLowerCase();
    const models = query
      ? selectedProvider.models.filter((m) =>
        m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
      : [...selectedProvider.models];
    return models.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return 0;
    });
  }, [selectedProvider, modelQuery]);

  const enabledModelCount = useMemo(() => {
    return selectedProvider?.models.filter((m) => m.enabled).length ?? 0;
  }, [selectedProvider]);

  const filteredTestModels = useMemo<IModelOption[]>(() => {
    if (!selectedProvider) {
      return [];
    }
    const query = testModelQuery.trim().toLowerCase();
    if (!query) {
      return selectedProvider.models;
    }
    return selectedProvider.models.filter((m) =>
      m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query));
  }, [selectedProvider, testModelQuery]);

  const defaultBaseUrl = selectedProvider ? getDefaultProviderBaseUrl(selectedProvider.id) : undefined;

  const handleSelectProvider = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
    setSyncFeedback(null);
    setModelQuery('');
    setExpandedModelId(null);
    setTestModelQuery('');
    setTestPopoverOpen(false);
    testRequestSeqRef.current += 1;
    setTestingModelId(null);
  }, []);

  const handleApiKeyChange = useCallback((providerId: string, value: string) => {
    setApiKeyInputs((prev) => ({ ...prev, [providerId]: value }));
  }, []);

  const handleBaseUrlChange = useCallback((providerId: string, value: string) => {
    setBaseUrlInputs((prev) => ({ ...prev, [providerId]: value }));
  }, []);

  const handleEnabledChange = useCallback(async (providerId: string, checked: boolean) => {
    await providerConfigService.updateProviderConfig(providerId, { enabled: checked });
  }, [providerConfigService]);

  const handleSaveProvider = useCallback(async (providerId: string) => {
    const apiKey = apiKeyInputs[providerId] || undefined;
    const baseUrl = baseUrlInputs[providerId] || undefined;
    await providerConfigService.updateProviderConfig(providerId, { apiKey, baseUrl });
  }, [apiKeyInputs, baseUrlInputs, providerConfigService]);

  const handleApplyDefaultBaseUrl = useCallback(async (providerId: string) => {
    const defaultUrl = getDefaultProviderBaseUrl(providerId);
    if (!defaultUrl) return;

    setBaseUrlInputs((prev) => ({ ...prev, [providerId]: defaultUrl }));
    try {
      await providerConfigService.updateProviderConfig(providerId, {
        apiKey: apiKeyInputs[providerId] || undefined,
        baseUrl: defaultUrl,
      });
    } catch {
      // Keep local state
    }
  }, [apiKeyInputs, providerConfigService]);

  const handleRefreshModels = useCallback(async (providerId: string) => {
    setSyncFeedback(null);
    setSyncingProviderId(providerId);

    try {
      const models = await providerConfigService.refreshProviderModels(providerId);
      setSyncFeedback({
        providerId,
        type: 'success',
        message: `${localeService.t('agent-ui.provider.fetch-models-success')} (${models.length})`,
      });
    } catch (error) {
      const fallback = localeService.t('agent-ui.provider.fetch-models-failed');
      const detail = error instanceof Error ? error.message : fallback;
      setSyncFeedback({ providerId, type: 'error', message: `${fallback}: ${detail}` });
    } finally {
      setSyncingProviderId(null);
    }
  }, [localeService, providerConfigService]);

  const handleToggleModelExpand = useCallback((modelId: string) => {
    setExpandedModelId((prev) => prev === modelId ? null : modelId);
  }, []);

  const handleTestModel = useCallback(async (model: IModelOption) => {
    setTestPopoverOpen(false);
    setTestModelQuery('');
    setSyncFeedback(null);
    setTestingModelId(model.id);

    const seq = ++testRequestSeqRef.current;
    // IModelOption.id is `${providerId}/${bareModelId}`; the server expects the bare id.
    const bareModelId = model.id.slice(model.providerId.length + 1);

    try {
      const result = await providerConfigService.testProviderModel(model.providerId, bareModelId);
      if (seq !== testRequestSeqRef.current) {
        return;
      }
      setSyncFeedback({
        providerId: model.providerId,
        type: 'success',
        message: localeService.t('agent-ui.provider.test-model-success', model.name, String(result.latencyMs)),
      });
    } catch (error) {
      if (seq !== testRequestSeqRef.current) {
        return;
      }
      const detail = error instanceof Error ? error.message : String(error);
      setSyncFeedback({
        providerId: model.providerId,
        type: 'error',
        message: `${localeService.t('agent-ui.provider.test-model-failed', model.name)}: ${detail}`,
      });
    } finally {
      if (seq === testRequestSeqRef.current) {
        setTestingModelId(null);
      }
    }
  }, [localeService, providerConfigService]);

  const isProviderSyncing = syncingProviderId && syncingProviderId === selectedProviderId;
  const isTesting = testingModelId !== null;

  return (
    <div
      className="
        tm:flex tm:h-full tm:min-h-0 tm:flex-col tm:gap-4
        tm:md:flex-row! tm:md:items-stretch
      "
    >
      {/* Left: Provider list */}
      <section
        className={cn(panelCls, `
          tm:flex tm:min-h-0 tm:flex-col tm:overflow-hidden
          tm:md:h-full tm:md:w-[220px] tm:md:shrink-0
        `)}
      >
        <div className="tm:border-b tm:border-line tm:p-3">
          <div className="tm:flex tm:items-center tm:justify-between tm:gap-2 tm:px-1">
            <h3 className="tm:text-sm tm:font-semibold tm:text-white">
              {localeService.t('agent-ui.provider.title')}
            </h3>
            <div className="tm:shrink-0 tm:text-[11px] tm:text-white/80">
              {providerList.length}
            </div>
          </div>
          <div className="tm:relative tm:mt-2">
            <Search
              size={12}
              className="tm:pointer-events-none tm:absolute tm:top-1/2 tm:left-2.5 tm:-translate-y-1/2 tm:text-white/70"
            />
            <Input
              className={cn(inputCls, 'tm:pl-7')}
              value={providerQuery}
              onChange={(e) => setProviderQuery(e.target.value)}
              placeholder={localeService.t('agent-ui.provider.search-provider')}
            />
          </div>
        </div>

        <div className="tm:flex-1 tm:space-y-1 tm:overflow-y-auto tm:p-2">
          {providerList.length > 0
            ? providerList.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleSelectProvider(provider.id)}
                className={cn(
                  `
                    tm:group
                    tm:flex tm:w-full tm:items-center tm:gap-2 tm:rounded-xl tm:border tm:border-transparent tm:p-2
                    tm:text-left tm:transition-all tm:duration-150
                  `,
                  selectedProviderId === provider.id
                    ? 'tm:border-blue/30 tm:bg-blue/10'
                    : 'tm:hover:border-line tm:hover:bg-one-bg2/45'
                )}
              >
                <span className="tm:flex tm:size-7 tm:shrink-0 tm:items-center tm:justify-center">
                  <ProviderLogo
                    providerId={provider.id}
                    className={cn('tm:size-6 tm:text-grey-fg2', {
                      'tm:text-blue': selectedProviderId === provider.id,
                    })}
                  />
                </span>

                <span className="tm:min-w-0 tm:flex-1">
                  <span className="tm:block tm:truncate tm:text-xs tm:font-medium tm:text-white">
                    {provider.name}
                  </span>
                  <span className="tm:block tm:truncate tm:text-[11px] tm:text-white/80">
                    {provider.enabledModelCount}
                    /
                    {provider.modelCount}
                    {' '}
                    {localeService.t('agent-ui.provider.models')}
                  </span>
                </span>

                <span className="tm:flex tm:items-center tm:gap-1.5">
                  <span className={cn('tm:size-2 tm:rounded-full', provider.isEnabled ? 'tm:bg-blue' : 'tm:bg-grey')} />
                  <ChevronRight
                    size={12}
                    className={cn(
                      'tm:text-white/70 tm:transition-transform tm:duration-150',
                      selectedProviderId === provider.id && 'tm:translate-x-0.5 tm:text-blue'
                    )}
                  />
                </span>
              </button>
            ))
            : (
              <div
                className="tm:flex tm:h-full tm:min-h-24 tm:items-center tm:justify-center tm:text-xs tm:text-white/80"
              >
                {localeService.t('agent-ui.provider.empty-provider')}
              </div>
            )}
        </div>

        <div className="tm:border-t tm:border-line tm:p-2">
          <AddProviderDialog />
        </div>
      </section>

      {/* Right: Provider detail */}
      <section
        className={cn(panelCls, `
          tm:flex tm:min-h-0 tm:flex-1 tm:flex-col tm:overflow-hidden
          tm:md:h-full
        `)}
      >
        {selectedProvider
          ? (
            <>
              {/* Header */}
              <header className="tm:border-b tm:border-line tm:p-4">
                <div className="tm:flex tm:flex-wrap tm:items-start tm:justify-between tm:gap-3">
                  <div className="tm:min-w-0">
                    <div className="tm:flex tm:items-center tm:gap-2">
                      <h3 className="tm:truncate tm:text-base tm:font-semibold tm:text-white">
                        {selectedProvider.name}
                      </h3>
                      {selectedProvider.enabled && (
                        <span
                          className={`
                            tm:rounded-full tm:bg-blue/80 tm:px-2.5 tm:py-0.5 tm:text-[11px] tm:font-semibold
                            tm:text-[#fff]
                          `}
                        >
                          Active
                        </span>
                      )}
                      {!selectedProvider.builtin && (
                        <span
                          className={`
                            tm:rounded-full tm:bg-purple/20 tm:px-2 tm:py-0.5 tm:text-[10px] tm:font-medium
                            tm:text-purple
                          `}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="tm:mt-1 tm:text-xs tm:text-white/80">{selectedProvider.id}</p>
                  </div>

                  <div className="tm:flex tm:items-center tm:gap-2">
                    <Popover
                      open={testPopoverOpen}
                      onOpenChange={(open) => {
                        if (!selectedProvider.enabled) {
                          return;
                        }
                        setTestPopoverOpen(open);
                        if (!open) {
                          setTestModelQuery('');
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="
                            tm:h-7 tm:gap-1 tm:px-2 tm:text-white
                            tm:disabled:opacity-50
                          "
                          disabled={!selectedProvider.enabled}
                          title={selectedProvider.enabled
                            ? localeService.t('agent-ui.provider.test-model')
                            : localeService.t('agent-ui.provider.test-model-disabled')}
                        >
                          {isTesting
                            ? <Loader2 size={13} className="tm:animate-spin tm:text-blue" />
                            : <Zap size={13} />}
                          <ChevronDown size={11} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="tm:w-65 tm:p-2"
                      >
                        <div className="tm:relative">
                          <Search
                            size={12}
                            className={`
                              tm:pointer-events-none tm:absolute tm:top-1/2 tm:left-2 tm:-translate-y-1/2
                              tm:text-white/70
                            `}
                          />
                          <Input
                            autoFocus
                            className={cn(inputCls, 'tm:pl-7')}
                            value={testModelQuery}
                            onChange={(e) => setTestModelQuery(e.target.value)}
                            placeholder={localeService.t('agent-ui.provider.test-model-search')}
                          />
                        </div>
                        <div className="tm:mt-2 tm:max-h-65 tm:space-y-0.5 tm:overflow-y-auto">
                          {filteredTestModels.length > 0
                            ? filteredTestModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => void handleTestModel(model)}
                                className={cn(
                                  `
                                    tm:flex tm:w-full tm:items-center tm:rounded-sm tm:px-2 tm:py-1.5 tm:text-left
                                    tm:text-xs tm:text-white/90
                                    tm:hover:bg-one-bg2
                                  `,
                                  { 'tm:bg-one-bg2': testingModelId === model.id }
                                )}
                              >
                                <span className="tm:truncate">{model.name}</span>
                              </button>
                            ))
                            : (
                              <div className="tm:py-3 tm:text-center tm:text-xs tm:text-white/60">
                                {localeService.t('agent-ui.model.no-models')}
                              </div>
                            )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Switch
                      checked={selectedProvider.enabled}
                      onCheckedChange={(checked) => void handleEnabledChange(selectedProvider.id, checked)}
                    />
                  </div>
                </div>

                {syncFeedback?.providerId === selectedProvider.id && (
                  <p
                    className={cn('tm:mt-2 tm:text-xs', syncFeedback.type === 'success'
                      ? 'tm:text-green'
                      : 'tm:text-yellow')}
                  >
                    {syncFeedback.message}
                  </p>
                )}
              </header>

              {/* Content */}
              <div className="tm:flex-1 tm:overflow-y-auto tm:px-4 tm:pt-4 tm:pb-2">
                <div className="tm:flex tm:min-h-full tm:flex-col tm:gap-4">
                  {/* API Key */}
                  <div className={sectionCls}>
                    <label className={labelCls}>
                      {localeService.t('agent-ui.provider.api-key')}
                    </label>
                    <Input
                      type="password"
                      className={cn(inputCls, 'tm:mt-2')}
                      placeholder="sk-..."
                      value={apiKeyInputs[selectedProvider.id] ?? ''}
                      onChange={(e) => handleApiKeyChange(selectedProvider.id, e.target.value)}
                      onBlur={() => void handleSaveProvider(selectedProvider.id)}
                    />
                  </div>

                  {/* Base URL */}
                  <div className={sectionCls}>
                    <div className="tm:flex tm:items-center tm:justify-between tm:gap-2">
                      <label className={labelCls}>
                        {localeService.t('agent-ui.provider.base-url')}
                      </label>
                      {defaultBaseUrl && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="
                            tm:h-6 tm:px-2 tm:text-[11px] tm:text-white/80
                            tm:hover:text-white
                          "
                          onClick={() => void handleApplyDefaultBaseUrl(selectedProvider.id)}
                        >
                          {localeService.t('agent-ui.provider.base-url-apply-default')}
                        </Button>
                      )}
                    </div>
                    <Input
                      className={cn(inputCls, 'tm:mt-2')}
                      placeholder={defaultBaseUrl ?? 'https://api.openai.com/v1'}
                      value={baseUrlInputs[selectedProvider.id] ?? ''}
                      onChange={(e) => handleBaseUrlChange(selectedProvider.id, e.target.value)}
                      onBlur={() => void handleSaveProvider(selectedProvider.id)}
                    />
                    {defaultBaseUrl && (
                      <p className="tm:mt-2 tm:text-[11px] tm:break-all tm:text-white/80">
                        {localeService.t('agent-ui.provider.base-url-default')}
                        {': '}
                        {defaultBaseUrl}
                      </p>
                    )}
                  </div>

                  {/* Models List */}
                  <div className={cn(sectionCls, 'tm:flex-1')}>
                    <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-between tm:gap-2">
                      <div className="tm:flex tm:items-center tm:gap-2">
                        <label className={labelCls}>
                          {localeService.t('agent-ui.provider.models')}
                        </label>
                        <span className="tm:text-[11px] tm:text-white/60">
                          {enabledModelCount}
                          {' / '}
                          {selectedProvider.models.length}
                        </span>
                      </div>
                      <div className="tm:flex tm:items-center tm:gap-1.5">
                        {!selectedProvider.builtin && (
                          <AddCustomModelDialog providerId={selectedProvider.id} />
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          className="tm:h-6 tm:gap-1 tm:text-white"
                          onClick={() => void handleRefreshModels(selectedProvider.id)}
                          disabled={!!isProviderSyncing}
                        >
                          <RefreshCw size={11} className={isProviderSyncing ? 'tm:animate-spin' : ''} />
                          fetch
                        </Button>
                      </div>
                    </div>

                    {/* Model search */}
                    <div className="tm:relative tm:mt-3">
                      <Search
                        size={12}
                        className={`
                          tm:pointer-events-none tm:absolute tm:top-1/2 tm:left-2.5 tm:-translate-y-1/2 tm:text-white/70
                        `}
                      />
                      <Input
                        className={cn(inputCls, 'tm:pl-7')}
                        value={modelQuery}
                        onChange={(e) => setModelQuery(e.target.value)}
                        placeholder={localeService.t('agent-ui.provider.search-model')}
                      />
                    </div>

                    {/* Model list */}
                    <div className="tm:mt-3 tm:max-h-100 tm:space-y-1.5 tm:overflow-y-auto">
                      {filteredModels.length > 0
                        ? filteredModels.map((model) => (
                          <div key={model.id}>
                            <ModelListItem
                              model={model}
                              isExpanded={expandedModelId === model.id}
                              onToggleExpand={handleToggleModelExpand}
                            />
                            {expandedModelId === model.id && (
                              <ModelConfigPanel
                                providerId={model.providerId}
                                modelId={model.id.split('/').slice(1).join('/')}
                                currentContextWindow={model.contextWindow}
                                currentMaxTokens={model.maxTokens}
                              />
                            )}
                          </div>
                        ))
                        : (
                          <div
                            className={`
                              tm:flex tm:min-h-16 tm:items-center tm:justify-center tm:text-xs tm:text-white/60
                            `}
                          >
                            {localeService.t('agent-ui.model.no-models')}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )
          : (
            <div className="tm:flex tm:flex-1 tm:items-center tm:justify-center tm:text-xs tm:text-grey">
              {localeService.t('agent-ui.provider.select-hint')}
            </div>
          )}
      </section>
    </div>
  );
}
