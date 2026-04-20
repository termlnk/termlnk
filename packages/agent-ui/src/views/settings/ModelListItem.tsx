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
import { LocaleService } from '@termlnk/core';
import { cn, Switch, useDependency } from '@termlnk/design';
import { IProviderConfigClientService } from '@termlnk/rpc-client';
import { Brain, Image, Settings } from 'lucide-react';
import { useCallback } from 'react';

interface IModelListItemProps {
  model: IModelOption;
  isExpanded: boolean;
  onToggleExpand: (modelId: string) => void;
}

function formatTokenCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return String(count);
}

function formatCost(cost: number): string {
  if (cost === 0) return 'Free';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function ModelListItem({ model, isExpanded, onToggleExpand }: IModelListItemProps) {
  const providerConfigService = useDependency(IProviderConfigClientService);
  const localeService = useDependency(LocaleService);

  const handleToggle = useCallback(async (checked: boolean) => {
    const parts = model.id.split('/');
    const providerId = parts[0];
    const modelId = parts.slice(1).join('/');
    await providerConfigService.toggleModel(providerId, modelId, checked);
  }, [model.id, providerConfigService]);

  const handleExpandClick = useCallback(() => {
    onToggleExpand(model.id);
  }, [model.id, onToggleExpand]);

  const displayName = model.name || model.id.split('/').slice(1).join('/');

  return (
    <div
      className={cn(
        'tm:rounded-lg tm:border tm:border-line/50 tm:transition-colors',
        model.enabled ? 'tm:bg-black/10' : 'tm:bg-black/5 tm:opacity-60'
      )}
    >
      <div className="tm:flex tm:items-center tm:gap-2.5 tm:px-3 tm:py-2">
        <div className="tm:min-w-0 tm:flex-1">
          <div className="tm:flex tm:items-center tm:gap-1.5">
            <span className="tm:truncate tm:text-xs tm:font-medium tm:text-white">
              {displayName}
            </span>
            {model.reasoning && (
              <Brain size={12} className="tm:shrink-0 tm:text-purple" />
            )}
            {model.input?.includes('image') && (
              <Image size={12} className="tm:shrink-0 tm:text-blue" />
            )}
          </div>
          <div className="tm:mt-0.5 tm:flex tm:items-center tm:gap-2 tm:text-[10px] tm:text-white/60">
            {model.contextWindow > 0 && (
              <span>
                {formatTokenCount(model.contextWindow)}
                {' '}
                ctx
              </span>
            )}
            {model.maxTokens > 0 && (
              <span>
                {formatTokenCount(model.maxTokens)}
                {' '}
                out
              </span>
            )}
            {(model.cost?.input > 0 || model.cost?.output > 0) && (
              <span>
                {formatCost(model.cost.input)}
                /
                {formatCost(model.cost.output)}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleExpandClick}
          className={cn(
            `
              tm:flex tm:size-6 tm:items-center tm:justify-center tm:rounded-md tm:text-white/50 tm:transition-colors
              tm:hover:bg-one-bg2 tm:hover:text-white
            `,
            isExpanded && 'tm:bg-one-bg2 tm:text-white'
          )}
          title={localeService.t('agent-ui.model.overrides')}
        >
          <Settings size={12} />
        </button>

        <Switch
          checked={model.enabled}
          onCheckedChange={(checked) => void handleToggle(checked)}
          className="tm:scale-75"
        />
      </div>
    </div>
  );
}
