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

import { LocaleService } from '@termlnk/core';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Switch, useDependency } from '@termlnk/design';
import { IProviderConfigService } from '@termlnk/rpc-client';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

const labelCls = 'tm:text-xs tm:font-medium tm:text-white';

interface IAddCustomModelDialogProps {
  providerId: string;
}

export function AddCustomModelDialog({ providerId }: IAddCustomModelDialogProps) {
  const localeService = useDependency(LocaleService);
  const providerConfigService = useDependency(IProviderConfigService);

  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState('');
  const [name, setName] = useState('');
  const [contextWindow, setContextWindow] = useState('128000');
  const [maxTokens, setMaxTokens] = useState('16384');
  const [reasoning, setReasoning] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!modelId.trim()) return;

    setSaving(true);
    try {
      await providerConfigService.addCustomModel(providerId, {
        id: modelId.trim(),
        name: name.trim() || undefined,
        contextWindow: Number.parseInt(contextWindow, 10) || 128000,
        maxTokens: Number.parseInt(maxTokens, 10) || 16384,
        reasoning,
      });
      setOpen(false);
      setModelId('');
      setName('');
      setContextWindow('128000');
      setMaxTokens('16384');
      setReasoning(false);
    } finally {
      setSaving(false);
    }
  }, [modelId, name, contextWindow, maxTokens, reasoning, providerId, providerConfigService]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="
            tm:h-6 tm:gap-1 tm:text-[11px] tm:text-white
            tm:hover:text-white
          "
        >
          <Plus size={11} />
          {localeService.t('agent-ui.provider.add-model')}
        </Button>
      </DialogTrigger>
      <DialogContent className="tm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{localeService.t('agent-ui.provider.add-model')}</DialogTitle>
        </DialogHeader>

        <div className="tm:space-y-3 tm:py-2">
          <div>
            <label className={labelCls}>Model ID *</label>
            <Input
              className="tm:mt-1.5 tm:h-8 tm:text-xs"
              placeholder="mistral:latest"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Name (Optional)</label>
            <Input
              className="tm:mt-1.5 tm:h-8 tm:text-xs"
              placeholder={modelId || 'Display name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="tm:grid tm:grid-cols-2 tm:gap-3">
            <div>
              <label className={labelCls}>Context Window</label>
              <Input
                className="tm:mt-1.5 tm:h-8 tm:text-xs"
                type="number"
                value={contextWindow}
                onChange={(e) => setContextWindow(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Max Tokens</label>
              <Input
                className="tm:mt-1.5 tm:h-8 tm:text-xs"
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            </div>
          </div>

          <div className="tm:flex tm:items-center tm:justify-between">
            <label className={labelCls}>Reasoning</label>
            <Switch checked={reasoning} onCheckedChange={setReasoning} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="primary"
            size="sm"
            disabled={!modelId.trim() || saving}
            onClick={() => void handleSave()}
          >
            {localeService.t('agent-ui.provider.add-model')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
