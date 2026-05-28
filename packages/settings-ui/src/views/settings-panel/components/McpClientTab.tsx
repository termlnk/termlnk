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
import { IMcpRegistryService, IMcpService } from '@termlnk/agent';
import { LocaleService } from '@termlnk/core';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn, FieldGroup, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, useDependency } from '@termlnk/design';
import { Activity, Plus, Search, Store, Unplug } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddMcpServerDialog } from './mcp-client/AddMcpServerDialog';
import { McpInstalled } from './mcp-client/McpInstalled';
import { McpMarketplace } from './mcp-client/McpMarketplace';

type McpClientSubView = 'marketplace' | 'installed';
type McpMarketplaceCategory = McpRegistryCategory | 'all';
type McpDialogState =
  | { mode: 'create' }
  | { mode: 'edit'; server: IMcpServer }
  | { mode: 'marketplace'; registryItem: IMcpRegistryItem };

const scrollContainerCls = `
  tm:h-full tm:overflow-y-auto
  tm:mask-[linear-gradient(to_bottom,black,black_calc(100%-16px),transparent)] tm:pr-1
`;

export function McpClientTab() {
  const localeService = useDependency(LocaleService);
  const mcpService = useDependency(IMcpService);
  const mcpRegistryService = useDependency(IMcpRegistryService);

  const [subView, setSubView] = useState<McpClientSubView>('marketplace');
  const [servers, setServers] = useState<IMcpServer[]>([]);
  const [registryItems, setRegistryItems] = useState<IMcpRegistryItem[]>([]);
  const [dialogState, setDialogState] = useState<McpDialogState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<McpMarketplaceCategory>('all');

  const loadServers = useCallback(async () => {
    const all = await mcpService.servers();
    setServers(all);
  }, [mcpService]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    mcpRegistryService.getAll().then(setRegistryItems);
  }, [mcpService]);

  const connectedCount = servers.filter((server) => server.status === 'connected').length;
  const categoryValues = useMemo(
    () => [...new Set(registryItems.map((item) => item.category).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [registryItems]
  );
  const categoryItems = useMemo(
    () => ['all', ...categoryValues].map((category) => ({
      value: category,
      label: category === 'all'
        ? localeService.t('settings-ui.mcp-client.marketplace-category-all')
        : category,
    })),
    [categoryValues, localeService]
  );

  const handleAddServerClick = useCallback(() => {
    setDialogState({ mode: 'create' });
  }, []);

  const handleEditServer = useCallback((server: IMcpServer) => {
    setDialogState({ mode: 'edit', server });
  }, []);

  const handleMarketplaceInstall = useCallback((registryItem: IMcpRegistryItem) => {
    setDialogState({ mode: 'marketplace', registryItem });
  }, []);

  const handleDialogSubmitted = useCallback(async () => {
    setSubView('installed');
    await loadServers();
  }, [loadServers]);

  useEffect(() => {
    if (activeCategory !== 'all' && !categoryValues.includes(activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, categoryValues]);

  return (
    <FieldGroup className="tm:gap-4">
      <Card className="tm:h-[min(520px,calc(100vh-332px))] tm:gap-0 tm:py-0">
        <CardHeader
          className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3 tm:pb-3"
        >
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
            <CardTitle className="tm:text-sm tm:font-semibold tm:text-white">
              {localeService.t('settings-ui.mcp-client.section-title')}
            </CardTitle>
            <CardDescription className="tm:text-xs tm:text-light-grey">
              {localeService.t('settings-ui.mcp-client.section-description')}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="tm:flex tm:h-full tm:min-h-0 tm:flex-col tm:py-4">
          <Tabs
            value={subView}
            onValueChange={(value) => value && setSubView(value as McpClientSubView)}
            className="tm:flex tm:h-full tm:min-h-0 tm:flex-col tm:gap-4"
          >
            <div className="tm:rounded-2xl tm:border tm:border-line tm:bg-black/10 tm:p-2.5 tm:text-white">
              <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-between tm:gap-3">
                <TabsList className="tm:h-auto tm:rounded-xl tm:border tm:border-line/70 tm:bg-one-bg/60 tm:p-1">
                  <TabsTrigger
                    value="marketplace"
                    className={cn(
                      `
                        tm:min-w-33 tm:items-center tm:justify-center tm:gap-2 tm:rounded-lg tm:px-3 tm:text-xs
                        tm:data-[state=active]:bg-blue/15 tm:data-[state=active]:text-blue
                        tm:data-[state=active]:shadow-none
                      `
                    )}
                  >
                    <Store className="tm:size-3.5" />
                    {localeService.t('settings-ui.mcp-client.sub-view-marketplace')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="installed"
                    className={cn(
                      `
                        tm:min-w-33 tm:items-center tm:justify-center tm:gap-2 tm:rounded-lg tm:px-3 tm:text-xs
                        tm:data-[state=active]:bg-blue/15 tm:data-[state=active]:text-blue
                        tm:data-[state=active]:shadow-none
                      `
                    )}
                  >
                    <Unplug className="tm:size-3.5" />
                    {localeService.t('settings-ui.mcp-client.sub-view-installed')}
                  </TabsTrigger>
                </TabsList>

                <div className="tm:flex tm:flex-wrap tm:items-center tm:justify-end tm:gap-2">
                  <Badge variant="secondary" className="tm:gap-1 tm:bg-one-bg2/85">
                    <Unplug className="tm:size-3" />
                    {localeService.t('settings-ui.mcp-client.installed-count', String(servers.length))}
                  </Badge>
                  <Badge variant="secondary" className="tm:gap-1 tm:bg-blue/10 tm:text-blue">
                    <Activity className="tm:size-3" />
                    {localeService.t('settings-ui.mcp-client.connected-count', String(connectedCount))}
                  </Badge>
                </div>
              </div>

              {subView === 'marketplace' && (
                <div
                  className="
                    tm:mt-3 tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:border-t tm:border-line/70 tm:pt-3
                  "
                >
                  <div className="tm:relative tm:min-w-60 tm:flex-1">
                    <Search
                      className="
                        tm:pointer-events-none tm:absolute tm:top-1/2 tm:left-2.5 tm:size-3.5 tm:-translate-y-1/2
                        tm:text-grey
                      "
                    />
                    <Input
                      className="tm:h-7 tm:pr-3 tm:pl-8 tm:text-xs"
                      placeholder={localeService.t('settings-ui.mcp-client.marketplace-search-placeholder')}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>

                  <Select
                    value={activeCategory}
                    onValueChange={(value) => setActiveCategory(value as McpMarketplaceCategory)}
                  >
                    <SelectTrigger
                      className="tm:w-33 tm:text-xs"
                      size="xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryItems.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="primary"
                    size="lg"
                    className="tm:h-7 tm:px-2 tm:text-xs"
                    onClick={handleAddServerClick}
                  >
                    <Plus className="tm:size-3" />
                    {localeService.t('settings-ui.mcp-client.add-server')}
                  </Button>
                </div>
              )}
            </div>

            <TabsContent value="marketplace" className="tm:m-0 tm:min-h-0 tm:flex-1 tm:overflow-hidden">
              <div className={scrollContainerCls}>
                <McpMarketplace
                  registryItems={registryItems}
                  installedServers={servers}
                  searchQuery={searchQuery}
                  activeCategory={activeCategory}
                  onInstallClick={handleMarketplaceInstall}
                />
              </div>
            </TabsContent>

            <TabsContent value="installed" className="tm:m-0 tm:min-h-0 tm:flex-1 tm:overflow-hidden">
              <div className={scrollContainerCls}>
                <McpInstalled
                  servers={servers}
                  onServersChanged={loadServers}
                  onAddServerClick={handleAddServerClick}
                  onEditServer={handleEditServer}
                />
              </div>
            </TabsContent>
          </Tabs>

          <AddMcpServerDialog
            open={dialogState !== null}
            onOpenChange={(open) => {
              if (!open) {
                setDialogState(null);
              }
            }}
            onSubmitted={handleDialogSubmitted}
            mode={dialogState?.mode ?? 'create'}
            server={dialogState?.mode === 'edit' ? dialogState.server : null}
            registryItem={dialogState?.mode === 'marketplace' ? dialogState.registryItem : null}
          />
        </CardContent>
      </Card>
    </FieldGroup>
  );
}
