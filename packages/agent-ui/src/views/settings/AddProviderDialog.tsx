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

import { KNOWN_API_TYPES } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useDependency } from '@termlnk/design';
import { IProviderConfigClientService } from '@termlnk/rpc-client';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

const labelCls = 'tm:text-xs tm:font-medium tm:text-white';

export function AddProviderDialog() {
  const localeService = useDependency(LocaleService);
  const providerConfigService = useDependency(IProviderConfigClientService);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiType, setApiType] = useState<string>('openai-completions');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !baseUrl.trim()) return;

    setSaving(true);
    try {
      const providerId = name.trim().toLowerCase().replace(/\s+/g, '-');
      await providerConfigService.addProvider({
        providerId,
        name: name.trim(),
        enabled: true,
        api: apiType,
        apiKey: apiKey.trim() || undefined,
        baseUrl: baseUrl.trim(),
      });
      setOpen(false);
      setName('');
      setBaseUrl('');
      setApiType('openai-completions');
      setApiKey('');
    } finally {
      setSaving(false);
    }
  }, [name, baseUrl, apiType, apiKey, providerConfigService]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="
            tm:w-full tm:gap-1.5 tm:text-xs tm:text-white/70
            tm:hover:text-white
          "
        >
          <Plus size={13} />
          {localeService.t('agent-ui.provider.add-provider')}
        </Button>
      </DialogTrigger>
      <DialogContent className="tm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localeService.t('agent-ui.provider.add-provider')}</DialogTitle>
        </DialogHeader>

        <div className="tm:space-y-4 tm:py-2">
          <div>
            <label className={labelCls}>Name *</label>
            <Input
              className="tm:mt-1.5 tm:h-8 tm:text-xs"
              placeholder="My Provider"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Base URL *</label>
            <Input
              className="tm:mt-1.5 tm:h-8 tm:text-xs"
              placeholder="http://localhost:11434/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>API Type</label>
            <div className="tm:mt-1.5">
              <Select value={apiType} onValueChange={setApiType}>
                <SelectTrigger size="sm" className="tm:w-full tm:text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_API_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className={labelCls}>API Key (Optional)</label>
            <Input
              className="tm:mt-1.5 tm:h-8 tm:text-xs"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="primary"
            size="sm"
            disabled={!name.trim() || !baseUrl.trim() || saving}
            onClick={() => void handleSave()}
          >
            {localeService.t('agent-ui.provider.add-provider')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
