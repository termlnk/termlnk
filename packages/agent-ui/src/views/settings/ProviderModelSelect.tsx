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

import type { IModelOption, IProviderGroup } from '@termlnk/agent';
import type { ReactElement } from 'react';
import { compareProviders } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { cn, SearchSelect, SearchSelectContent, SearchSelectEmpty, SearchSelectGroup, SearchSelectInput, SearchSelectItem, SearchSelectList, SearchSelectTrigger, useDependency, useObservable } from '@termlnk/design';
import { IProviderConfigClientService } from '@termlnk/rpc-client';
import { Brain, ChevronDown, Eye, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ProviderLogo } from './provider-logo';

/**
 * Form-style provider/model selector. Visually similar to ChatModelSelector but:
 *   - Fully controlled (caller owns the value).
 *   - Uses a wide form-friendly trigger instead of the chat-toolbar trigger.
 *   - Optionally surfaces a "use default" entry at the top of the list.
 *
 * Selecting the default entry emits `null`. Selecting a model emits its
 * composite id (`{providerId}/{modelId}`). When the resolved providers list
 * does not contain `value`, the trigger falls back to displaying the raw id
 * so a stale config never silently disappears.
 */
export interface IProviderModelSelectProps {
  /** Composite id `{providerId}/{modelId}` or null for "default". */
  value: string | null;
  /** Called with a composite id on model select, or `null` if defaultEntry was selected. */
  onChange: (modelId: string | null) => void;
  className?: string;
  triggerClassName?: string;
  /**
   * When provided, renders an extra entry above the model groups that emits
   * `null` on select. Use this to expose a "fall back to chat model" option.
   */
  defaultEntry?: {
    label: string;
    description?: string;
  };
  /** Trigger placeholder shown when value is null and defaultEntry is not provided. */
  placeholder?: string;
  disabled?: boolean;
}

interface IGroupedProvider extends IProviderGroup {
  models: IModelOption[];
}

function extractModelId(fullId: string): string {
  const slashIndex = fullId.indexOf('/');
  return slashIndex >= 0 ? fullId.slice(slashIndex + 1) : fullId;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return String(tokens);
}

export function ProviderModelSelect(props: IProviderModelSelectProps): ReactElement {
  const {
    value,
    onChange,
    className,
    triggerClassName,
    defaultEntry,
    placeholder,
    disabled,
  } = props;

  const providerConfigService = useDependency(IProviderConfigClientService);
  const localeService = useDependency(LocaleService);
  const providers = useObservable(providerConfigService.providers$, []);
  const [open, setOpen] = useState(false);

  const groupedProviders = useMemo<IGroupedProvider[]>(() => {
    return providers
      .filter((provider) => provider.enabled)
      .map((provider) => ({
        ...provider,
        models: provider.models.filter((model: IModelOption) => model.enabled),
      }))
      .filter((provider) => provider.models.length > 0)
      .sort(compareProviders);
  }, [providers]);

  const selectedModel = useMemo<IModelOption | null>(() => {
    if (!value) {
      return null;
    }
    for (const provider of providers) {
      const found = provider.models.find((m) => m.id === value);
      if (found) {
        return found;
      }
    }
    return null;
  }, [providers, value]);

  const handleSelectModel = useCallback((modelId: string) => {
    onChange(modelId);
    setOpen(false);
  }, [onChange]);

  const handleSelectDefault = useCallback(() => {
    onChange(null);
    setOpen(false);
  }, [onChange]);

  // Trigger label: prefer the resolved model name, then fall back to:
  //   - default entry label (if value is null and defaultEntry exists)
  //   - the raw id (if value points at a model that's not in current providers)
  //   - the placeholder
  const triggerLabel = useMemo(() => {
    if (selectedModel) {
      return selectedModel.name;
    }
    if (!value && defaultEntry) {
      return defaultEntry.label;
    }
    if (value) {
      return extractModelId(value);
    }
    return placeholder ?? localeService.t('agent-ui.model.select-model');
  }, [selectedModel, value, defaultEntry, placeholder, localeService]);

  const triggerProviderId = selectedModel?.providerId;

  return (
    <div className={cn('tm:relative tm:min-w-0', className)}>
      <SearchSelect open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <SearchSelectTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              `
                tm:flex tm:h-10 tm:w-full tm:min-w-0 tm:cursor-pointer tm:items-center tm:gap-2 tm:rounded-md tm:border
                tm:border-line tm:bg-black/30 tm:px-3 tm:text-sm tm:text-light-grey tm:transition-colors
                tm:hover:bg-black/40
                tm:disabled:cursor-not-allowed tm:disabled:opacity-60
              `,
              triggerClassName
            )}
          >
            {triggerProviderId
              ? (
                <ProviderLogo
                  providerId={triggerProviderId}
                  className="tm:size-4 tm:shrink-0 tm:text-current"
                />
              )
              : (
                <Sparkles className="tm:size-4 tm:shrink-0 tm:text-current" />
              )}
            <span className="tm:min-w-0 tm:flex-1 tm:truncate tm:text-left">
              {triggerLabel}
            </span>
            <ChevronDown className="tm:size-4 tm:shrink-0 tm:text-grey-fg" />
          </button>
        </SearchSelectTrigger>
        <SearchSelectContent
          side="bottom"
          sideOffset={6}
          align="start"
          className="tm:min-h-[240px] tm:w-(--radix-popover-trigger-width)"
        >
          <SearchSelectInput placeholder={localeService.t('agent-ui.model.search-models')} />
          <SearchSelectEmpty>{localeService.t('agent-ui.model.no-models')}</SearchSelectEmpty>
          <SearchSelectList className="tm:max-h-72">
            {defaultEntry && (
              <SearchSelectGroup>
                <SearchSelectItem
                  value={defaultEntry.label}
                  selected={value === null}
                  onSelect={handleSelectDefault}
                  className="tm:items-start tm:py-2"
                >
                  <Sparkles className="tm:mt-0.5 tm:size-3.5 tm:shrink-0 tm:text-grey-fg" />
                  <div className="tm:min-w-0 tm:flex-1">
                    <div className="tm:truncate tm:text-xs tm:font-semibold tm:text-white">
                      {defaultEntry.label}
                    </div>
                    {defaultEntry.description && (
                      <div className="tm:mt-0.5 tm:truncate tm:text-[10px] tm:text-grey-fg">
                        {defaultEntry.description}
                      </div>
                    )}
                  </div>
                </SearchSelectItem>
              </SearchSelectGroup>
            )}
            {groupedProviders.map((provider) => (
              <SearchSelectGroup
                key={provider.id}
                heading={(
                  <div className="tm:flex tm:items-center tm:gap-1.5">
                    <ProviderLogo providerId={provider.id} className="tm:size-3.5" />
                    <span>{provider.name}</span>
                  </div>
                )}
              >
                {provider.models.map((model) => (
                  <SearchSelectItem
                    key={model.id}
                    value={model.name}
                    selected={value === model.id}
                    onSelect={() => handleSelectModel(model.id)}
                    className="tm:items-start tm:py-2"
                  >
                    <div className="tm:min-w-0 tm:flex-1">
                      <div className="tm:truncate tm:text-xs tm:font-semibold tm:text-white">
                        {model.name}
                      </div>
                      <div className="tm:mt-0.5 tm:flex tm:items-center tm:gap-1.5 tm:text-[10px] tm:text-grey-fg">
                        {model.input?.includes('image') && (
                          <Eye size={10} className="tm:shrink-0" />
                        )}
                        {model.reasoning && (
                          <Brain size={10} className="tm:shrink-0" />
                        )}
                        {model.contextWindow > 0 && (
                          <span>{formatContextWindow(model.contextWindow)}</span>
                        )}
                      </div>
                    </div>
                    <span className="tm:shrink-0 tm:pt-0.5 tm:text-[10px] tm:text-grey-fg">
                      {extractModelId(model.id)}
                    </span>
                  </SearchSelectItem>
                ))}
              </SearchSelectGroup>
            ))}
          </SearchSelectList>
        </SearchSelectContent>
      </SearchSelect>
    </div>
  );
}
