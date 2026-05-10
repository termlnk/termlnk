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

import type { ISettingsState } from '../../models/settings.state';
import type { ISettingsTabDescriptor } from '../../services/settings-tab-registry/settings-tab-registry.service';
import { LocaleService } from '@termlnk/core';
import { cn, Tabs, TabsContent, TabsList, TabsTrigger, useDependency, useObservable } from '@termlnk/design';
import { useCallback, useEffect, useMemo } from 'react';
import { ISettingsTabRegistryService } from '../../services/settings-tab-registry/settings-tab-registry.service';
import { SettingsService } from '../../services/settings/settings.service';

export const SETTINGS_PANEL_COMPONENT_NAME = 'settings-ui.component.settings-panel';

const EMPTY_TABS: ISettingsTabDescriptor[] = [];

export function SettingsPanel() {
  const localeService = useDependency(LocaleService);
  const settingsService = useDependency(SettingsService);
  const tabRegistry = useDependency(ISettingsTabRegistryService);

  const state = useObservable<ISettingsState | null>(settingsService.state$, null);
  const tabs = useObservable<ISettingsTabDescriptor[]>(tabRegistry.tabs$, EMPTY_TABS);

  const requestedTab = state?.activeTab ?? '';
  const activeTab = useMemo<ISettingsTabDescriptor | null>(() => {
    if (tabs.length === 0) {
      return null;
    }
    return tabs.find((t) => t.id === requestedTab) ?? tabs[0];
  }, [tabs, requestedTab]);

  // When the requested tab disappears (e.g. its visible$ flipped to false, or
  // a plugin unregistered it), reconcile the SettingsService state so persisted
  // navigation eventually points at a real tab id again.
  useEffect(() => {
    if (!activeTab || requestedTab === activeTab.id) {
      return;
    }
    settingsService.setActiveTab(activeTab.id);
  }, [activeTab, requestedTab, settingsService]);

  const handleTabChange = useCallback(
    (value: string) => {
      settingsService.setActiveTab(value);
    },
    [settingsService]
  );

  if (!activeTab) {
    return null;
  }

  const ActiveIcon = activeTab.icon;

  return (
    <div
      className={`
        tm:flex tm:h-[min(680px,calc(100vh-210px))] tm:w-full tm:overflow-hidden tm:rounded-xl tm:border tm:border-line
        tm:bg-black2
      `}
    >
      <Tabs
        orientation="vertical"
        value={activeTab.id}
        onValueChange={handleTabChange}
        className="tm:flex-1 tm:gap-0 tm:overflow-hidden"
      >
        <div
          className="
            tm:flex tm:min-h-0 tm:w-[136px] tm:shrink-0 tm:basis-[136px] tm:flex-col tm:border-r tm:border-line
            tm:bg-black2
          "
        >
          <TabsList
            orientation="vertical"
            className="
              tm:min-h-0 tm:w-full tm:flex-1 tm:gap-0 tm:overflow-x-hidden tm:overflow-y-auto tm:bg-transparent tm:p-0
            "
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  orientation="vertical"
                  className={cn(
                    `
                      tm:group
                      tm:relative tm:h-10 tm:w-full tm:justify-start tm:gap-2 tm:rounded-none tm:border-0
                      tm:bg-transparent tm:px-2.5 tm:text-[13px] tm:font-semibold tm:text-white tm:transition-colors
                      tm:duration-200 tm:select-none
                      tm:hover:bg-blue/10 tm:hover:text-white
                      tm:focus-visible:ring tm:focus-visible:ring-blue/35 tm:focus-visible:outline-none
                      tm:focus-visible:ring-inset
                      tm:data-[state=active]:bg-blue/20 tm:data-[state=active]:text-blue
                      tm:data-[state=active]:shadow-none
                      tm:data-[state=active]:after:absolute tm:data-[state=active]:after:top-0
                      tm:data-[state=active]:after:right-0 tm:data-[state=active]:after:z-10
                      tm:data-[state=active]:after:h-full tm:data-[state=active]:after:w-[2px]
                      tm:data-[state=active]:after:rounded-none tm:data-[state=active]:after:bg-blue
                      tm:data-[state=active]:after:content-[""]
                      tm:data-[state=active]:hover:bg-blue/20 tm:data-[state=active]:hover:text-blue
                    `
                  )}
                >
                  <Icon className="tm:size-4 tm:shrink-0 tm:text-inherit" />
                  <span className="tm:truncate">{localeService.t(tab.labelKey)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:overflow-hidden tm:bg-black/25">
          <div className="tm:border-b tm:border-line tm:px-6 tm:py-3">
            <div className="tm:flex tm:items-center tm:gap-2">
              <ActiveIcon className="tm:size-3.5 tm:text-blue" />
              <h2 className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t(activeTab.labelKey)}
              </h2>
            </div>
            {activeTab.descriptionKey && (
              <p className="tm:mt-0.5 tm:text-[11px] tm:text-grey-fg">
                {localeService.t(activeTab.descriptionKey)}
              </p>
            )}
          </div>

          <div className="tm:flex tm:min-h-0 tm:flex-1 tm:flex-col tm:overflow-hidden">
            {tabs.map((tab) => {
              const TabComponent = tab.component;
              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="tm:m-0 tm:min-h-0 tm:overflow-y-auto tm:px-6 tm:py-5"
                >
                  <TabComponent />
                </TabsContent>
              );
            })}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
