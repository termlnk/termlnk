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
import { LocaleService } from '@termlnk/core';
import { cn, SearchSelect, SearchSelectContent, SearchSelectEmpty, SearchSelectGroup, SearchSelectInput, SearchSelectItem, SearchSelectList, SearchSelectTrigger, useDependency, useObservable } from '@termlnk/design';
import { IProviderConfigClientService } from '@termlnk/rpc-client';
import { Brain, ChevronDown, Eye, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ProviderLogo } from '../settings/provider-logo';
import { compareProviders } from '../settings/provider-metadata';

interface IChatModelSelectorProps {
  className?: string;
  triggerClassName?: string;
  showStatusDot?: boolean;
  showModelTag?: boolean;
}

function extractModelTag(name: string): string | null {
  const match = name.match(/\b\d+(?:\.\d+)?[bk]\b/i);
  return match ? match[0].toUpperCase() : null;
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

interface IGroupedProvider extends IProviderGroup {
  models: IModelOption[];
}

export function ChatModelSelector(props: IChatModelSelectorProps) {
  const { className, triggerClassName, showStatusDot = false, showModelTag = false } = props;
  const providerConfigService = useDependency(IProviderConfigClientService);
  const localeService = useDependency(LocaleService);
  const providers = useObservable(providerConfigService.providers$, []);
  const activeModel = useObservable(providerConfigService.activeModel$, null);
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

  const handleSelectModel = useCallback((modelId: string) => {
    void providerConfigService.setActiveModel(modelId);
    setOpen(false);
  }, [providerConfigService]);

  const modelTag = useMemo(() => {
    if (!activeModel?.name) {
      return null;
    }
    return extractModelTag(activeModel.name);
  }, [activeModel?.name]);

  return (
    <div className={cn('tm:relative tm:min-w-0', className)}>
      <SearchSelect open={open} onOpenChange={setOpen}>
        <SearchSelectTrigger asChild>
          <button
            type="button"
            className={cn(
              `
                tm:flex tm:min-w-0 tm:cursor-pointer tm:items-center tm:gap-1.5 tm:rounded-md tm:bg-transparent
                tm:text-light-grey tm:transition-colors
                tm:hover:text-white
              `,
              triggerClassName
            )}
          >
            {showStatusDot && (
              <span
                className="tm:size-2 tm:shrink-0 tm:rounded-full tm:bg-green tm:shadow-[0_0_0_3px_rgba(34,197,94,0.2)]"
              />
            )}
            {activeModel
              ? (
                <ProviderLogo
                  providerId={activeModel.providerId}
                  className="tm:size-3.5 tm:shrink-0 tm:text-current"
                />
              )
              : (
                <Sparkles className="tm:size-3.5 tm:shrink-0 tm:text-current" />
              )}
            <span
              className={`
                tm:min-w-0 tm:flex-1 tm:truncate tm:text-[0.75rem] tm:font-normal tm:text-current
                tm:@max-[220px]/chat-toolbar:hidden
              `}
            >
              {activeModel?.name ?? localeService.t('agent-ui.model.select-model')}
            </span>
            {showModelTag && modelTag && (
              <span
                className={`
                  tm:shrink-0 tm:text-[0.72rem] tm:font-semibold tm:text-current
                  tm:@max-[220px]/chat-toolbar:hidden
                `}
              >
                {modelTag}
              </span>
            )}
            <ChevronDown
              className={`
                tm:size-3.5 tm:shrink-0 tm:text-light-grey
                tm:@max-[220px]/chat-toolbar:hidden
              `}
            />
          </button>
        </SearchSelectTrigger>
        <SearchSelectContent
          side="top"
          sideOffset={6}
          align="start"
          className="tm:min-h-[240px] tm:w-[250px]"
        >
          <SearchSelectInput placeholder={localeService.t('agent-ui.model.search-models')} />
          <SearchSelectEmpty>{localeService.t('agent-ui.model.no-models')}</SearchSelectEmpty>
          <SearchSelectList className="tm:max-h-72">
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
                    selected={activeModel?.id === model.id}
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
