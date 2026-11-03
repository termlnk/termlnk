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

import type { IACPProviderDescriptor, IACPProviderStatus } from '@termlnk/acp';
import { ACP_PROVIDER_REGISTRY, IACPDiscoveryService } from '@termlnk/acp';
import { LocaleService } from '@termlnk/core';
import { Button, cn, Input, Switch, useDependency, useObservable } from '@termlnk/design';
import { IExternalLinkService } from '@termlnk/ui';
import { ChevronRight, ExternalLink, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ACPProviderDialog } from './ACPProviderDialog';
import { ProviderIcon } from './ProviderIcon';

export function ACPTab() {
  const localeService = useDependency(LocaleService);
  const discovery = useDependency(IACPDiscoveryService);
  const providers = useObservable(discovery.providers$, []);

  const [query, setQuery] = useState('');
  const [openProviderId, setOpenProviderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const configuredIds = useMemo(
    () => new Set(providers.map((p) => p.descriptor.id)),
    [providers]
  );

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ACP_PROVIDER_REGISTRY.filter((entry) => {
      if (configuredIds.has(entry.id)) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return entry.title.toLowerCase().includes(needle)
        || entry.description.toLowerCase().includes(needle)
        || entry.id.includes(needle);
    });
  }, [query, configuredIds]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await discovery.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [discovery]);

  const openProvider = providers.find((p) => p.descriptor.id === openProviderId) ?? null;

  return (
    <div className="tm:flex tm:flex-col tm:gap-6">
      <section className="tm:flex tm:flex-col tm:gap-2">
        <header className="tm:flex tm:items-center tm:gap-2">
          <h3 className="tm:flex-1 tm:text-xs tm:font-medium tm:text-grey-fg2">
            {localeService.t('acp-ui.settings.providers')}
          </h3>
          <Button variant="ghost" size="icon-xs" disabled={refreshing} onClick={() => void refreshAll()}>
            <RefreshCw size={14} className={cn({ 'tm:animate-spin': refreshing })} />
          </Button>
        </header>

        <div className="tm:overflow-hidden tm:rounded-lg tm:border tm:border-line">
          {providers.length === 0 && (
            <div className="tm:px-3 tm:py-4 tm:text-center tm:text-xs tm:text-grey">
              {localeService.t('acp-ui.settings.no-providers')}
            </div>
          )}
          {providers.map((status, index) => (
            <ProviderRow
              key={status.descriptor.id}
              status={status}
              first={index === 0}
              onOpen={() => setOpenProviderId(status.descriptor.id)}
            />
          ))}
        </div>
      </section>

      <section className="tm:flex tm:flex-col tm:gap-2">
        <h3 className="tm:text-xs tm:font-medium tm:text-grey-fg2">
          {localeService.t('acp-ui.settings.add-provider')}
        </h3>

        <div className="tm:relative">
          <Search size={14} className="tm:absolute tm:top-2.5 tm:left-2.5 tm:text-grey" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localeService.t('acp-ui.settings.search-providers')}
            className="tm:pl-8"
          />
        </div>

        <div className="tm:overflow-hidden tm:rounded-lg tm:border tm:border-line">
          {available.length === 0 && (
            <div className="tm:px-3 tm:py-4 tm:text-center tm:text-xs tm:text-grey">
              {localeService.t('acp-ui.settings.no-matches')}
            </div>
          )}
          {available.map((entry, index) => (
            <CatalogRow key={entry.id} entry={entry} first={index === 0} />
          ))}
        </div>
      </section>

      {openProvider && (
        <ACPProviderDialog
          status={openProvider}
          onClose={() => setOpenProviderId(null)}
        />
      )}
    </div>
  );
}

function ProviderRow({
  status,
  first,
  onOpen,
}: {
  status: IACPProviderStatus;
  first: boolean;
  onOpen: () => void;
}) {
  const localeService = useDependency(LocaleService);
  const discovery = useDependency(IACPDiscoveryService);
  const { descriptor, availability, enabled } = status;

  const stateLabel = !enabled
    ? localeService.t('acp-ui.settings.status.disabled')
    : availability.state === 'installed'
      ? localeService.t('acp-ui.settings.status.available')
      : availability.state === 'on-demand'
        ? localeService.t('acp-ui.settings.status.on-demand')
        : localeService.t('acp-ui.settings.status.not-installed');

  const stateTone = !enabled
    ? 'tm:bg-grey'
    : availability.state === 'installed'
      ? 'tm:bg-green'
      : availability.state === 'on-demand'
        ? 'tm:bg-yellow'
        : 'tm:bg-red';

  const modelCount = status.capabilities?.models.length ?? 0;

  return (
    <div
      className={cn(
        `
          tm:group
          tm:flex tm:items-center tm:gap-2 tm:px-3 tm:py-2.5
          tm:hover:bg-one-bg
        `,
        { 'tm:border-t tm:border-line': !first }
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="tm:flex tm:min-w-0 tm:flex-1 tm:items-center tm:gap-2.5 tm:text-left"
      >
        <ChevronRight size={14} className="tm:shrink-0 tm:text-grey" />
        <ProviderIcon iconId={descriptor.iconId ?? descriptor.id} title={descriptor.title} size={22} />
        <span className="tm:min-w-0">
          <span className="tm:flex tm:items-center tm:gap-1.5">
            <span className="tm:truncate tm:text-sm tm:text-light-grey">{descriptor.title}</span>
            {descriptor.version && (
              <span className="tm:shrink-0 tm:text-[10px] tm:text-grey">{descriptor.version}</span>
            )}
          </span>
          <span className="tm:mt-0.5 tm:flex tm:items-center tm:gap-1.5 tm:text-[11px] tm:text-grey">
            <span className={cn('tm:size-1.5 tm:shrink-0 tm:rounded-full', stateTone)} />
            {stateLabel}
            {modelCount > 0 && (
              <>
                <span>·</span>
                <span>{localeService.t('acp-ui.settings.model-count', String(modelCount))}</span>
              </>
            )}
          </span>
        </span>
      </button>

      <Switch
        checked={enabled}
        onCheckedChange={(next) => void discovery.setProviderEnabled(descriptor.id, next)}
      />

      {descriptor.source === 'user' && (
        <Button
          variant="ghost"
          size="icon-xs"
          title={localeService.t('acp-ui.settings.remove')}
          onClick={() => void discovery.removeUserProvider(descriptor.id)}
        >
          <Trash2 size={14} />
        </Button>
      )}
    </div>
  );
}

function CatalogRow({
  entry,
  first,
}: {
  entry: IACPProviderDescriptor;
  first: boolean;
}) {
  const localeService = useDependency(LocaleService);
  const discovery = useDependency(IACPDiscoveryService);
  const externalLinkService = useDependency(IExternalLinkService);
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const add = useCallback(async () => {
    setAdding(true);
    setFailure(null);
    try {
      // Catalog entries are added as user providers: the shipped catalog is a
      // constant, so anything the user chooses has to live in their config.
      const { source: _source, ...rest } = entry;
      await discovery.addUserProvider(rest);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }, [discovery, entry]);

  return (
    <div
      className={cn(
        'tm:flex tm:items-start tm:gap-2.5 tm:px-3 tm:py-2.5',
        { 'tm:border-t tm:border-line': !first }
      )}
    >
      <ProviderIcon iconId={entry.iconId ?? entry.id} title={entry.title} size={26} />
      <div className="tm:min-w-0 tm:flex-1">
        <div className="tm:flex tm:items-center tm:gap-1.5">
          <span className="tm:truncate tm:text-sm tm:text-light-grey">{entry.title}</span>
          {entry.version && (
            <span className="tm:shrink-0 tm:text-[10px] tm:text-grey">{entry.version}</span>
          )}
        </div>
        <p className="tm:mt-0.5 tm:line-clamp-2 tm:text-[11px] tm:text-grey-fg">
          {entry.description}
        </p>
        {entry.installLink && (
          <button
            type="button"
            onClick={() => externalLinkService.openExternal(entry.installLink ?? '')}
            className="
              tm:mt-1 tm:flex tm:items-center tm:gap-1 tm:text-[11px] tm:text-nord-blue
              tm:hover:underline
            "
          >
            {localeService.t('acp-ui.settings.install-guide')}
            <ExternalLink size={10} />
          </button>
        )}
        {failure && <p className="tm:mt-1 tm:text-[11px] tm:text-red">{failure}</p>}
      </div>
      <Button size="sm" disabled={adding} onClick={() => void add()}>
        <Plus size={12} />
        {localeService.t('acp-ui.settings.add')}
      </Button>
    </div>
  );
}
