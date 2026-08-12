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

import type { IACPProviderStatus } from '@termlnk/acp';
import { IACPDiscoveryService, IACPSessionService } from '@termlnk/acp';
import { LocaleService } from '@termlnk/core';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  useDependency,
  useObservable,
} from '@termlnk/design';
import { FileText, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ProviderIcon } from './ProviderIcon';

export interface IACPProviderDialogProps {
  status: IACPProviderStatus;
  onClose: () => void;
}

export function ACPProviderDialog({ status, onClose }: IACPProviderDialogProps) {
  const localeService = useDependency(LocaleService);
  const discovery = useDependency(IACPDiscoveryService);
  const sessionService = useDependency(IACPSessionService);
  const providers = useObservable(discovery.providers$, []);

  const providerId = status.descriptor.id;
  // Track the live entry: probing replaces it in providers$, and the prop is a
  // snapshot from the moment the row was clicked.
  const live = providers.find((p) => p.descriptor.id === providerId) ?? status;

  const [query, setQuery] = useState('');
  const [probing, setProbing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const [addingModel, setAddingModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');

  const models = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = live.capabilities?.models ?? [];
    return needle
      ? all.filter((m) => m.id.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle))
      : all;
  }, [live.capabilities, query]);

  const probe = useCallback(async (force: boolean) => {
    setProbing(true);
    setFailure(null);
    try {
      await discovery.probeCapabilities(providerId, force);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setProbing(false);
    }
  }, [discovery, providerId]);

  const diagnose = useCallback(async () => {
    setFailure(null);
    try {
      setDiagnostics(await sessionService.diagnose(providerId));
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    }
  }, [sessionService, providerId]);

  const addModel = useCallback(async () => {
    const id = newModelId.trim();
    if (!id) {
      return;
    }
    await discovery.addCustomModel(providerId, id);
    setNewModelId('');
    setAddingModel(false);
  }, [discovery, newModelId, providerId]);

  const probedAt = live.capabilities?.probedAt;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="tm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="tm:flex tm:items-center tm:gap-2">
            <ProviderIcon
              iconId={live.descriptor.iconId ?? providerId}
              title={live.descriptor.title}
              size={22}
            />
            {live.descriptor.title}
          </DialogTitle>
        </DialogHeader>

        <p className="tm:font-mono tm:text-[11px] tm:break-all tm:text-grey">
          {live.descriptor.command.join(' ')}
        </p>
        {live.availability.state === 'installed' && live.availability.resolvedPath && (
          <p className="tm:font-mono tm:text-[11px] tm:break-all tm:text-grey-fg">
            {live.availability.resolvedPath}
          </p>
        )}

        <div className="tm:relative tm:mt-1">
          <Search size={14} className="tm:absolute tm:top-2.5 tm:left-2.5 tm:text-grey" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localeService.t('acp-ui.settings.search-models')}
            className="tm:pl-8"
          />
        </div>

        <div className="tm:flex tm:items-center tm:justify-between tm:text-[11px] tm:text-grey">
          <span>{localeService.t('acp-ui.settings.discovered')}</span>
          <span className="tm:tabular-nums">{models.length}</span>
        </div>

        <div className="tm:max-h-64 tm:overflow-y-auto tm:rounded-lg tm:border tm:border-line">
          {models.length === 0 && (
            <div className="tm:px-3 tm:py-4 tm:text-center tm:text-[11px] tm:text-grey">
              {live.capabilities
                ? localeService.t('acp-ui.settings.no-models')
                : localeService.t('acp-ui.settings.not-probed')}
            </div>
          )}
          {models.map((model, index) => (
            <div
              key={model.id}
              className={cn(
                `
                  tm:group
                  tm:flex tm:items-center tm:gap-2 tm:px-3 tm:py-1.5
                  tm:hover:bg-one-bg
                `,
                { 'tm:border-t tm:border-line': index > 0 }
              )}
            >
              <span className="tm:min-w-0 tm:flex-1 tm:truncate tm:text-xs tm:text-light-grey">
                {model.name}
              </span>
              <span className="tm:shrink-0 tm:font-mono tm:text-[10px] tm:text-grey">{model.id}</span>
              {model.custom && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title={localeService.t('acp-ui.settings.remove')}
                  onClick={() => void discovery.removeCustomModel(providerId, model.id)}
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          ))}
        </div>

        {addingModel && (
          <div className="tm:flex tm:items-center tm:gap-2">
            <Input
              autoFocus
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              placeholder={localeService.t('acp-ui.settings.model-id-placeholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void addModel();
                }
              }}
            />
            <Button size="sm" disabled={!newModelId.trim()} onClick={() => void addModel()}>
              {localeService.t('acp-ui.settings.add')}
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => setAddingModel(false)}>
              <X size={14} />
            </Button>
          </div>
        )}

        {failure && <p className="tm:text-[11px] tm:wrap-break-word tm:text-red">{failure}</p>}

        {diagnostics && (
          <pre
            className={cn(`
              tm:max-h-40 tm:overflow-auto tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:px-2 tm:py-1.5
              tm:font-mono tm:text-[11px] tm:whitespace-pre-wrap tm:text-grey-fg2 tm:select-text
            `)}
          >
            {diagnostics}
          </pre>
        )}

        <div className="tm:flex tm:items-center tm:gap-2">
          <span className="tm:flex-1 tm:text-[11px] tm:text-grey">
            {probedAt
              ? localeService.t('acp-ui.settings.updated-at', formatRelative(probedAt, localeService))
              : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setAddingModel(true)}>
            <Plus size={12} />
            {localeService.t('acp-ui.settings.add-model')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void diagnose()}>
            <FileText size={12} />
            {localeService.t('acp-ui.settings.diagnose')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={probing}
            onClick={() => void probe(true)}
          >
            <RefreshCw size={12} className={cn({ 'tm:animate-spin': probing })} />
            {localeService.t('acp-ui.settings.refresh')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Coarse relative time; a probe is minutes-to-days old, never seconds-precise. */
function formatRelative(timestamp: number, localeService: LocaleService): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) {
    return localeService.t('acp-ui.settings.just-now');
  }
  if (minutes < 60) {
    return localeService.t('acp-ui.settings.minutes-ago', String(minutes));
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return localeService.t('acp-ui.settings.hours-ago', String(hours));
  }
  return localeService.t('acp-ui.settings.days-ago', String(Math.round(hours / 24)));
}
