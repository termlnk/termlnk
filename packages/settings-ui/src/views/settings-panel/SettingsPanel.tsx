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

import type { ITheme } from '@termlnk/themes';
import type { ComponentType } from 'react';
import type { ISettingsState } from '../../models/settings.state';
import { AgentTab } from '@termlnk/agent-ui';
import { isMacintosh, IThemeService, LocaleService } from '@termlnk/core';
import { cn, Tabs, TabsContent, TabsList, TabsTrigger, useDependency, useObservable } from '@termlnk/design';
import { Info, Keyboard, LayoutDashboard, MessageSquare, Monitor, Palette, Smartphone, Sparkles, Terminal, Unplug, Wand2, Wifi } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { SettingsTab } from '../../models/settings.state';
import { SettingsService } from '../../services/settings/settings.service';
import { AboutTab } from './components/AboutTab';
import { AiProviderTab } from './components/AiProviderTab';
import { AppearanceTab } from './components/AppearanceTab';
import { ColorSchemeTab } from './components/ColorSchemeTab';
import { InterfaceTab } from './components/InterfaceTab';
import { IslandTab } from './components/island/IslandTab';
import { MCPTab } from './components/McpTab';
import { NetworkTab } from './components/NetworkTab';
import { ShortcutsTab } from './components/ShortcutsTab';
import { SkillTab } from './components/SkillTab';
import { TerminalTab } from './components/TerminalTab';

export const SETTINGS_PANEL_COMPONENT_NAME = 'settings-ui.component.settings-panel';

interface ITabDef {
  key: SettingsTab;
  labelKey: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  platform?: 'darwin';
}

const TABS: ITabDef[] = [
  {
    key: SettingsTab.APPEARANCE,
    labelKey: 'settings-ui.tab.appearance',
    description: 'settings-ui.tab-description.appearance',
    icon: Monitor,
  },
  {
    key: SettingsTab.INTERFACE,
    labelKey: 'settings-ui.tab.interface',
    description: 'settings-ui.tab-description.interface',
    icon: LayoutDashboard,
  },
  {
    key: SettingsTab.TERMINAL,
    labelKey: 'settings-ui.tab.terminal',
    description: 'settings-ui.tab-description.terminal',
    icon: Terminal,
  },
  {
    key: SettingsTab.COLOR_SCHEME,
    labelKey: 'settings-ui.tab.color-scheme',
    description: 'settings-ui.tab-description.color-scheme',
    icon: Palette,
  },
  {
    key: SettingsTab.NETWORK,
    labelKey: 'settings-ui.tab.network',
    description: 'settings-ui.tab-description.network',
    icon: Wifi,
  },
  {
    key: SettingsTab.MCP,
    labelKey: 'settings-ui.tab.mcp',
    description: 'settings-ui.tab-description.mcp',
    icon: Unplug,
  },
  {
    key: SettingsTab.AI_PROVIDER,
    labelKey: 'settings-ui.tab.ai-provider',
    description: 'settings-ui.tab-description.ai-provider',
    icon: Sparkles,
  },
  {
    key: SettingsTab.CHAT,
    labelKey: 'settings-ui.tab.chat',
    description: 'settings-ui.tab-description.chat',
    icon: MessageSquare,
  },
  {
    key: SettingsTab.SKILL,
    labelKey: 'settings-ui.tab.skill',
    description: 'settings-ui.tab-description.skill',
    icon: Wand2,
  },
  {
    key: SettingsTab.ISLAND,
    labelKey: 'settings-ui.tab.island',
    description: 'settings-ui.tab-description.island',
    icon: Smartphone,
    platform: 'darwin',
  },
  {
    key: SettingsTab.SHORTCUTS,
    labelKey: 'settings-ui.tab.shortcuts',
    description: 'settings-ui.tab-description.shortcuts',
    icon: Keyboard,
  },
  {
    key: SettingsTab.ABOUT,
    labelKey: 'settings-ui.tab.about',
    description: 'settings-ui.tab-description.about',
    icon: Info,
  },
];

export function SettingsPanel() {
  const localeService = useDependency(LocaleService);
  const settingsService = useDependency(SettingsService);
  const themeService = useDependency(IThemeService);

  const state = useObservable<ISettingsState | null>(settingsService.state$, null);
  const currentTheme = useObservable<ITheme | null>(themeService.currentTheme$, null);

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => !tab.platform || (tab.platform === 'darwin' && isMacintosh)),
    []
  );

  const activeTab = state?.activeTab ?? SettingsTab.APPEARANCE;
  const activeTabDef = visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0];
  const ActiveIcon = activeTabDef.icon;

  const handleTabChange = useCallback(
    (value: string) => {
      settingsService.setActiveTab(value as SettingsTab);
    },
    [settingsService]
  );

  return (
    <div
      className={`
        tm:flex tm:h-[min(680px,calc(100vh-210px))] tm:w-full tm:overflow-hidden tm:rounded-xl tm:border tm:border-line
        tm:bg-black2
      `}
    >
      <Tabs
        orientation="vertical"
        value={activeTab}
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
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
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
                <tab.icon className="tm:size-4 tm:shrink-0 tm:text-inherit" />
                <span className="tm:truncate">{localeService.t(tab.labelKey)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:overflow-hidden tm:bg-black/25">
          <div className="tm:border-b tm:border-line tm:px-6 tm:py-3">
            <div className="tm:flex tm:items-center tm:gap-2">
              <ActiveIcon className="tm:size-3.5 tm:text-blue" />
              <h2 className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t(activeTabDef.labelKey)}
              </h2>
            </div>
            <p className="tm:mt-0.5 tm:text-[11px] tm:text-grey-fg">
              {localeService.t(activeTabDef.description)}
            </p>
          </div>

          <div className="tm:flex-1 tm:overflow-y-auto tm:px-6 tm:py-5">
            <TabsContent value={SettingsTab.APPEARANCE} className="tm:m-0">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value={SettingsTab.INTERFACE} className="tm:m-0">
              <InterfaceTab />
            </TabsContent>
            <TabsContent value={SettingsTab.TERMINAL} className="tm:m-0">
              <TerminalTab />
            </TabsContent>
            <TabsContent value={SettingsTab.COLOR_SCHEME} className="tm:m-0">
              <ColorSchemeTab currentTheme={currentTheme} />
            </TabsContent>
            <TabsContent value={SettingsTab.NETWORK} className="tm:m-0">
              <NetworkTab />
            </TabsContent>
            <TabsContent value={SettingsTab.MCP} className="tm:m-0">
              <MCPTab />
            </TabsContent>
            <TabsContent value={SettingsTab.AI_PROVIDER} className="tm:m-0 tm:h-full">
              <AiProviderTab />
            </TabsContent>
            <TabsContent value={SettingsTab.CHAT} className="tm:m-0">
              <AgentTab />
            </TabsContent>
            <TabsContent value={SettingsTab.SKILL} className="tm:m-0">
              <SkillTab />
            </TabsContent>
            <TabsContent value={SettingsTab.ISLAND} className="tm:m-0">
              <IslandTab />
            </TabsContent>
            <TabsContent value={SettingsTab.SHORTCUTS} className="tm:m-0">
              <ShortcutsTab />
            </TabsContent>
            <TabsContent value={SettingsTab.ABOUT} className="tm:m-0">
              <AboutTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
