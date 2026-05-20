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

import type { IModelOverrides } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, Input, useDependency } from '@termlnk/design';
import { IProviderConfigService } from '@termlnk/rpc-client';
import { RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';

interface IModelConfigPanelProps {
  providerId: string;
  modelId: string;
  currentContextWindow: number;
  currentMaxTokens: number;
}

const labelCls = 'tm:text-[11px] tm:font-medium tm:text-white/80';
const inputCls = 'tm:h-7 tm:text-xs';

export function ModelConfigPanel({
  providerId,
  modelId,
  currentContextWindow,
  currentMaxTokens,
}: IModelConfigPanelProps) {
  const localeService = useDependency(LocaleService);
  const providerConfigService = useDependency(IProviderConfigService);

  const [maxTokens, setMaxTokens] = useState('');
  const [contextWindow, setContextWindow] = useState('');

  const handleSave = useCallback(async () => {
    const overrides: IModelOverrides = {};

    if (maxTokens.trim()) {
      const parsed = Number.parseInt(maxTokens.trim(), 10);
      if (!Number.isNaN(parsed) && parsed > 0) overrides.maxTokens = parsed;
    }

    if (contextWindow.trim()) {
      const parsed = Number.parseInt(contextWindow.trim(), 10);
      if (!Number.isNaN(parsed) && parsed > 0) overrides.contextWindow = parsed;
    }

    if (Object.keys(overrides).length > 0) {
      await providerConfigService.updateModelOverrides(providerId, modelId, overrides);
    }
  }, [maxTokens, contextWindow, providerId, modelId, providerConfigService]);

  const handleReset = useCallback(async () => {
    setMaxTokens('');
    setContextWindow('');
    await providerConfigService.resetModelOverrides(providerId, modelId);
  }, [providerId, modelId, providerConfigService]);

  return (
    <div className="tm:border-t tm:border-line/30 tm:bg-black/10 tm:px-3 tm:py-2.5">
      <div className="tm:grid tm:grid-cols-2 tm:gap-3">
        <div>
          <label className={labelCls}>Max Tokens</label>
          <Input
            className={inputCls}
            type="number"
            placeholder={String(currentMaxTokens)}
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            onBlur={() => void handleSave()}
          />
        </div>
        <div>
          <label className={labelCls}>Context Window</label>
          <Input
            className={inputCls}
            type="number"
            placeholder={String(currentContextWindow)}
            value={contextWindow}
            onChange={(e) => setContextWindow(e.target.value)}
            onBlur={() => void handleSave()}
          />
        </div>
      </div>
      <div className="tm:mt-2 tm:flex tm:justify-end">
        <Button
          variant="ghost"
          size="xs"
          className="
            tm:h-6 tm:gap-1 tm:text-[11px] tm:text-white/60
            tm:hover:text-white
          "
          onClick={() => void handleReset()}
        >
          <RotateCcw size={11} />
          {localeService.t('agent-ui.model.reset-defaults')}
        </Button>
      </div>
    </div>
  );
}
