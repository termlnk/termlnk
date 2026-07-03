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

import type { IExtensionDescription } from '@termlnk/extension';
import { LocaleService } from '@termlnk/core';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, useDependency } from '@termlnk/design';
import { IExtensionService } from '@termlnk/extension';
import { IExtensionManagementService } from '@termlnk/rpc-client';
import { Download, FolderOpen, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ExtensionListItem } from './ExtensionListItem';
import { ExtensionMarketplace } from './ExtensionMarketplace';
import { InstallFromNpmDialog } from './InstallFromNpmDialog';

type ExtensionTab = 'installed' | 'marketplace';

export function ExtensionExplorer() {
  const extensionService = useDependency(IExtensionService);
  const extensionManagementService = useDependency(IExtensionManagementService);
  const localeService = useDependency(LocaleService);

  const [extensions, setExtensions] = useState<IExtensionDescription[]>([]);
  const [activeTab, setActiveTab] = useState<ExtensionTab>('installed');
  const [installDialogOpen, setInstallDialogOpen] = useState(false);

  const refreshList = useCallback(() => {
    setExtensions(extensionService.getExtensions());
  }, [extensionService]);

  useEffect(() => {
    refreshList();
    const sub = extensionService.onChange$.subscribe(() => {
      refreshList();
    });
    return () => sub.unsubscribe();
  }, [extensionService, refreshList]);

  const handleLoadLocal = useCallback(async () => {
    try {
      const result = await extensionManagementService.showOpenDirectoryDialog(
        localeService.t('extension-ui.action.selectDirectory')
      );

      if (result.canceled || !result.path) {
        return;
      }

      await extensionService.loadLocalExtension(result.path);
    } catch (err) {
      console.error('[ExtensionExplorer] Failed to load local extension:', err);
    }
  }, [extensionManagementService, extensionService, localeService]);

  const handleRefresh = useCallback(async () => {
    try {
      await extensionService.reloadExtension('');
    } catch {
      // ignore, just refresh list
    }
    refreshList();
  }, [extensionService, refreshList]);

  const handleEnable = useCallback(async (id: string) => {
    await extensionService.enableExtension(id);
  }, [extensionService]);

  const handleDisable = useCallback(async (id: string) => {
    await extensionService.disableExtension(id);
  }, [extensionService]);

  const handleUninstall = useCallback(async (id: string) => {
    const ext = extensionService.getExtension(id);
    if (ext?.isDev) {
      await extensionService.removeLocalExtension(id);
    } else {
      await extensionService.uninstallExtension(id);
    }
  }, [extensionService]);

  const handleReload = useCallback(async (id: string) => {
    await extensionService.reloadExtension(id);
  }, [extensionService]);

  return (
    <div className="tm:flex tm:h-full tm:flex-col tm:bg-black2">
      {/* Header */}
      <div
        className={`
          tm:box-border tm:flex tm:h-10 tm:w-full tm:flex-row tm:items-center tm:px-2 tm:text-[12px] tm:font-normal
          tm:select-none
        `}
      >
        <div className="tm:flex tm:size-full tm:items-center tm:truncate tm:overflow-hidden">
          {localeService.t('extension-ui.menu.extensions')}
        </div>
        <div className="tm:flex tm:h-full tm:items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setInstallDialogOpen(true)}
            title={localeService.t('extension-ui.action.installFromNpm')}
          >
            <Download strokeWidth={1.5} size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleLoadLocal}
            title={localeService.t('extension-ui.action.loadLocal')}
          >
            <FolderOpen strokeWidth={1.5} size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleRefresh}
            title={localeService.t('extension-ui.action.refresh')}
          >
            <RefreshCw strokeWidth={1.5} size={14} />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => value && setActiveTab(value as ExtensionTab)}
        className="tm:flex tm:min-h-0 tm:flex-1 tm:flex-col tm:gap-2"
      >
        <TabsList className="tm:mx-2 tm:h-8 tm:shrink-0">
          <TabsTrigger value="installed" className="tm:h-full tm:flex-1 tm:text-xs">
            {localeService.t('extension-ui.tab.installed')}
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="tm:h-full tm:flex-1 tm:text-xs">
            {localeService.t('extension-ui.tab.marketplace')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="tm:m-0 tm:min-h-0 tm:flex-1 tm:overflow-y-auto tm:p-1">
          {extensions.length === 0
            ? (
              <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:text-xs tm:text-grey">
                {localeService.t('extension-ui.empty')}
              </div>
            )
            : (
              <div className="tm:flex tm:flex-col tm:gap-0.5">
                {extensions.map((ext) => (
                  <ExtensionListItem
                    key={ext.id}
                    extension={ext}
                    onEnable={handleEnable}
                    onDisable={handleDisable}
                    onUninstall={handleUninstall}
                    onReload={handleReload}
                  />
                ))}
              </div>
            )}
        </TabsContent>

        <TabsContent value="marketplace" className="tm:m-0 tm:min-h-0 tm:flex-1">
          <ExtensionMarketplace />
        </TabsContent>
      </Tabs>

      <InstallFromNpmDialog
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
      />
    </div>
  );
}
