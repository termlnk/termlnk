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

import type { IRegistryExtensionMetadata } from '@termlnk/extension';
import { LocaleService } from '@termlnk/core';
import { cn, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle, Input, useDependency } from '@termlnk/design';
import { IExtensionService } from '@termlnk/extension';
import { IExtensionManagementService } from '@termlnk/rpc-client';
import { Search, Store } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExtensionMarketplaceCard } from './ExtensionMarketplaceCard';

export function ExtensionMarketplace() {
  const localeService = useDependency(LocaleService);
  const extensionService = useDependency(IExtensionService);
  const extensionManagementService = useDependency(IExtensionManagementService);

  const [items, setItems] = useState<IRegistryExtensionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [errorByItem, setErrorByItem] = useState<Map<string, string>>(new Map());
  const [installedIds, setInstalledIds] = useState<Set<string>>(
    () => new Set(extensionService.getExtensions().map((e) => e.id))
  );

  const refreshInstalled = useCallback(() => {
    setInstalledIds(new Set(extensionService.getExtensions().map((e) => e.id)));
  }, [extensionService]);

  useEffect(() => {
    const sub = extensionService.onChange$.subscribe(() => refreshInstalled());
    return () => sub.unsubscribe();
  }, [extensionService, refreshInstalled]);

  const loadFeatured = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const featured = await extensionManagementService.getRegistryFeatured();
      setItems(featured);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [extensionManagementService]);

  useEffect(() => {
    void loadFeatured();
  }, [loadFeatured]);

  const handleInstall = useCallback(async (item: IRegistryExtensionMetadata) => {
    setInstallingIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    setErrorByItem((prev) => {
      if (!prev.has(item.id)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(item.id);
      return next;
    });

    try {
      await extensionService.installRemoteExtension({
        extensionId: item.id,
        npmPackage: item.npmPackage,
        version: item.latestVersion,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorByItem((prev) => {
        const next = new Map(prev);
        next.set(item.id, message);
        return next;
      });
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }, [extensionService]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => (
      item.displayName.toLowerCase().includes(query)
      || item.id.toLowerCase().includes(query)
      || item.description.toLowerCase().includes(query)
      || item.keywords?.some((k) => k.toLowerCase().includes(query))
    ));
  }, [items, searchQuery]);

  return (
    <div className="tm:flex tm:size-full tm:min-h-0 tm:flex-col tm:gap-2">
      <div className="tm:relative tm:shrink-0 tm:px-2">
        <Search
          className={cn(`
            tm:pointer-events-none tm:absolute tm:top-1/2 tm:left-4 tm:size-3.5 tm:-translate-y-1/2 tm:text-grey
          `)}
        />
        <Input
          className="tm:h-7 tm:pr-3 tm:pl-8 tm:text-xs"
          placeholder={localeService.t('extension-ui.marketplace.search')}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <div className="tm:flex-1 tm:overflow-y-auto tm:px-2 tm:pb-2">
        {loading && (
          <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:text-xs tm:text-grey">
            ...
          </div>
        )}

        {!loading && loadError && (
          <Empty className="tm:py-6">
            <EmptyHeader>
              <EmptyTitle className="tm:text-xs tm:text-red">
                {localeService.t('extension-ui.marketplace.loadFailed')}
              </EmptyTitle>
              <EmptyDescription className="tm:text-[11px]">
                {loadError}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {!loading && !loadError && filteredItems.length === 0 && (
          <Empty className="tm:py-6">
            <EmptyHeader>
              <Store className="tm:size-6 tm:text-grey" />
              <EmptyTitle className="tm:text-xs">
                {localeService.t('extension-ui.marketplace.empty')}
              </EmptyTitle>
              <EmptyDescription className="tm:text-[11px]">
                {localeService.t('extension-ui.marketplace.emptyHint')}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        )}

        {!loading && filteredItems.length > 0 && (
          <div className="tm:flex tm:flex-col tm:gap-2">
            {filteredItems.map((item) => (
              <ExtensionMarketplaceCard
                key={item.id}
                item={item}
                installed={installedIds.has(item.id)}
                installing={installingIds.has(item.id)}
                error={errorByItem.get(item.id)}
                onInstall={handleInstall}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
