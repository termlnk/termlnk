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

import type { IMcpRegistryItem, IMcpServer, McpRegistryCategory } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, cn, useDependency } from '@termlnk/design';
import { BadgeCheck, Star } from 'lucide-react';
import { useMemo } from 'react';

interface IMcpMarketplaceProps {
  registryItems: IMcpRegistryItem[];
  installedServers: IMcpServer[];
  searchQuery: string;
  activeCategory: McpRegistryCategory | 'all';
  onInstallClick: (item: IMcpRegistryItem) => void;
}

export function McpMarketplace({ registryItems, installedServers, searchQuery, activeCategory, onInstallClick }: IMcpMarketplaceProps) {
  const localeService = useDependency(LocaleService);

  const installedRegistryIds = useMemo(
    () => new Set(installedServers.map((server) => server.registryId).filter((value): value is string => !!value)),
    [installedServers]
  );
  const installedNames = useMemo(
    () => new Set(installedServers.map((server) => server.name.toLowerCase())),
    [installedServers]
  );

  const filteredItems = useMemo(() => {
    let items = registryItems;

    if (activeCategory !== 'all') {
      items = items.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => (
        item.name.toLowerCase().includes(query)
        || item.description.toLowerCase().includes(query)
        || item.tags.some((tag) => tag.toLowerCase().includes(query))
      ));
    }

    return items;
  }, [activeCategory, registryItems, searchQuery]);

  return (
    <div className="tm:flex tm:flex-col tm:gap-4">
      {filteredItems.length === 0 && (
        <section
          className={cn(`
            tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/50 tm:p-4 tm:transition-all
            tm:hover:border-blue/30 tm:hover:bg-one-bg/80
          `)}
        >
          <p className="tm:text-center tm:text-sm tm:text-grey-fg">
            {localeService.t('settings-ui.mcp-client.marketplace-empty')}
          </p>
        </section>
      )}

      {filteredItems.map((item) => {
        const isInstalled = installedRegistryIds.has(item.registryId) || installedNames.has(item.name.toLowerCase());

        return (
          <section
            key={item.id}
            className={cn(`
              tm:rounded-2xl tm:border tm:border-line tm:bg-one-bg/50 tm:p-4 tm:transition-all
              tm:hover:border-blue/30 tm:hover:bg-one-bg/80
            `)}
          >
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-3">
              <div className="tm:min-w-0 tm:flex-1">
                <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-1.5">
                  <span className="tm:text-sm tm:font-semibold tm:text-white">
                    {item.name}
                  </span>

                  {item.verified && (
                    <Badge
                      variant="secondary"
                      className="tm:gap-1 tm:border-blue/25 tm:bg-blue/10 tm:text-[10px] tm:text-blue"
                    >
                      <BadgeCheck className="tm:size-2" />
                      {localeService.t('settings-ui.mcp-client.marketplace-verified')}
                    </Badge>
                  )}

                  {item.featured && (
                    <Badge
                      variant="secondary"
                      className="tm:gap-1 tm:border-yellow/20 tm:bg-yellow/10 tm:text-[10px] tm:text-yellow"
                    >
                      <Star className="tm:size-2 tm:fill-yellow tm:text-yellow" />
                      {localeService.t('settings-ui.mcp-client.marketplace-featured')}
                    </Badge>
                  )}
                </div>

                <p className="tm:mt-0.5 tm:text-[11px]/relaxed tm:text-light-grey">
                  {item.description}
                </p>

                <div className="tm:mt-2 tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:text-white">
                  <span className="tm:text-[10px]">{item.author}</span>
                  {item.version && (
                    <>
                      <span className="tm:text-[10px]">·</span>
                      <span className="tm:text-[10px]">
                        v
                        {item.version}
                      </span>
                    </>
                  )}
                  <span className="tm:text-[10px]">·</span>
                  <span className="tm:text-[10px]">
                    {item.transport === 'stdio'
                      ? localeService.t('settings-ui.mcp-client.transport-stdio')
                      : localeService.t('settings-ui.mcp-client.transport-remote')}
                  </span>
                  <Badge
                    variant="secondary"
                    className="tm:bg-blue/8 tm:px-1.5 tm:py-0.5 tm:text-[9px] tm:text-blue"
                  >
                    {item.category}
                  </Badge>

                  {item.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="tm:bg-one-bg2 tm:px-1.5 tm:py-0.5 tm:text-[9px]"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                variant={isInstalled ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => !isInstalled && onInstallClick(item)}
                disabled={isInstalled}
              >
                {isInstalled
                  ? localeService.t('settings-ui.mcp-client.marketplace-installed')
                  : localeService.t('settings-ui.mcp-client.marketplace-install')}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
