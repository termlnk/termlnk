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

import type { IAppSettings } from '@termlnk/electron';
import { LocaleService, LocaleType, Quantity } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, cn, Field, FieldContent, FieldGroup, FieldLabel, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, useDependency } from '@termlnk/design';
import { ELECTRON_PLUGIN_CONFIG_KEY, normalizeAppSettings } from '@termlnk/electron';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { IHostEnvironmentService, UI_PLUGIN_CONFIG_KEY } from '@termlnk/ui';
import { useCallback, useEffect, useState } from 'react';

const horizontalFieldLabelCls = 'tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white';

export function AppearanceTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);
  // Optional binding: WebRendererPlugin registers `web`, desktop leaves it
  // unbound (treated as `electron`). Tray / auto-launch / power management
  // controls only make sense when the underlying shell can act on them.
  const hostEnvironment = useDependency(IHostEnvironmentService, Quantity.OPTIONAL);
  const isElectronShell = (hostEnvironment?.host ?? 'electron') === 'electron';

  const [currentLocale, setCurrentLocale] = useState<string>(localeService.getCurrentLocale());
  const [appSettings, setAppSettings] = useState<IAppSettings>(() => normalizeAppSettings(null));

  const handleLocaleChange = useCallback(
    (value: string) => {
      setCurrentLocale(value);
      localeService.setLocale(value as LocaleType);
      void configManagerService.setField(UI_PLUGIN_CONFIG_KEY, 'locale', value);
    },
    [localeService, configManagerService]
  );

  const updateAppSettings = useCallback(
    (updates: Partial<IAppSettings>) => {
      setAppSettings((prev) => {
        const next = normalizeAppSettings({ ...prev, ...updates });
        void configManagerService.setField(ELECTRON_PLUGIN_CONFIG_KEY, 'appSettings', next);
        return next;
      });
    },
    [configManagerService]
  );

  useEffect(() => {
    let active = true;
    configManagerService.getField<IAppSettings>(ELECTRON_PLUGIN_CONFIG_KEY, 'appSettings')
      .then((stored) => {
        if (active) {
          setAppSettings(normalizeAppSettings(stored));
        }
      })
      .catch((err) => {
        console.error('[AppearanceTab] Failed to load app settings:', err);
        if (active) {
          setAppSettings(normalizeAppSettings(null));
        }
      });
    return () => {
      active = false;
    };
  }, [configManagerService]);

  return (
    <FieldGroup className="tm:gap-5">
      {/* Language Settings */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.appearance.language-settings-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4">
            <Field orientation="horizontal">
              <FieldLabel className={cn('tm:h-8 tm:w-28 tm:flex-none tm:shrink-0 tm:text-sm/8 tm:font-normal')}>
                {localeService.t('settings-ui.appearance.language')}
              </FieldLabel>
              <FieldContent className="tm:items-end">
                <Select value={currentLocale} onValueChange={handleLocaleChange}>
                  <SelectTrigger className={cn('tm:h-8 tm:w-40 tm:px-2 tm:text-xs')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LocaleType.ZH_CN}>中文（简体）</SelectItem>
                    <SelectItem value={LocaleType.ZH_TW}>中文（繁體）</SelectItem>
                    <SelectItem value={LocaleType.EN_US}>English</SelectItem>
                    <SelectItem value={LocaleType.JA_JP}>日本語</SelectItem>
                    <SelectItem value={LocaleType.KO_KR}>한국어</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {isElectronShell
        ? (
            <>
              {/* System Tray Settings — Electron-only (no browser API for system tray) */}
              <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
                <CardHeader
                  className={cn('tm:bg-black/10 tm:py-3', {
                    'tm:border-b tm:border-line tm:pb-3': appSettings.trayEnabled,
                  })}
                >
                  <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
                    <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
                      <FieldLabel htmlFor="settings-tray-enabled" className="tm:text-sm tm:font-semibold tm:text-white">
                        {localeService.t('settings-ui.appearance.tray-enable')}
                      </FieldLabel>
                      <Switch
                        id="settings-tray-enabled"
                        checked={appSettings.trayEnabled}
                        onCheckedChange={(checked) => updateAppSettings({ trayEnabled: checked })}
                      />
                    </div>
                    <CardDescription className="tm:text-xs">
                      {localeService.t('settings-ui.appearance.tray-enable-description')}
                    </CardDescription>
                  </div>
                </CardHeader>

                {appSettings.trayEnabled && (
                  <CardContent>
                    <FieldGroup className="tm:my-4 tm:gap-4">
                      <Field orientation="horizontal" className="tm:items-start">
                        <FieldLabel htmlFor="settings-close-to-tray" className={horizontalFieldLabelCls}>
                          <span className="tm:text-sm tm:font-normal">
                            {localeService.t('settings-ui.appearance.close-to-tray')}
                          </span>
                          <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                            {localeService.t('settings-ui.appearance.close-to-tray-description')}
                          </span>
                        </FieldLabel>
                        <FieldContent className="tm:flex-none tm:items-end">
                          <Switch
                            id="settings-close-to-tray"
                            checked={appSettings.closeToTray}
                            onCheckedChange={(checked) => updateAppSettings({ closeToTray: checked })}
                          />
                        </FieldContent>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                )}
              </Card>

              {/* Startup Settings — OS auto-launch is Electron-only */}
              <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
                <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
                  <h3 className="tm:text-sm tm:font-semibold tm:text-white">
                    {localeService.t('settings-ui.appearance.startup-title')}
                  </h3>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="tm:my-4 tm:gap-4">
                    <Field orientation="horizontal" className="tm:items-start">
                      <FieldLabel htmlFor="settings-auto-launch" className={horizontalFieldLabelCls}>
                        <span className="tm:text-sm tm:font-normal">
                          {localeService.t('settings-ui.appearance.auto-launch')}
                        </span>
                        <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                          {localeService.t('settings-ui.appearance.auto-launch-description')}
                        </span>
                      </FieldLabel>
                      <FieldContent className="tm:flex-none tm:items-end">
                        <Switch
                          id="settings-auto-launch"
                          checked={appSettings.autoLaunchEnabled}
                          onCheckedChange={(checked) => updateAppSettings({ autoLaunchEnabled: checked })}
                        />
                      </FieldContent>
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              {/* Keep Screen Awake — relies on Electron's powerSaveBlocker */}
              <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
                <CardHeader className="tm:bg-black/10 tm:py-3">
                  <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
                    <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
                      <FieldLabel htmlFor="settings-keep-awake" className="tm:text-sm tm:font-semibold tm:text-white">
                        {localeService.t('settings-ui.appearance.keep-awake-title')}
                      </FieldLabel>
                      <Switch
                        id="settings-keep-awake"
                        checked={appSettings.keepAwakeWhileAgentActive}
                        onCheckedChange={(checked) => updateAppSettings({ keepAwakeWhileAgentActive: checked })}
                      />
                    </div>
                    <CardDescription className="tm:text-xs">
                      {localeService.t('settings-ui.appearance.keep-awake-description')}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </>
          )
        : null}
    </FieldGroup>
  );
}
