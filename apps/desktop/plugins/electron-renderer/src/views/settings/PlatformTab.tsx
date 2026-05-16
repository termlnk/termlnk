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
import { LocaleService } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, cn, Field, FieldContent, FieldGroup, FieldLabel, Switch, useDependency } from '@termlnk/design';
import { ELECTRON_PLUGIN_CONFIG_KEY, normalizeAppSettings } from '@termlnk/electron';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useState } from 'react';

const horizontalFieldLabelCls = 'tm:min-w-0 tm:flex-1 tm:flex-col tm:items-start tm:gap-1 tm:text-white';

/**
 * PlatformTab — desktop-only OS integration switches: system tray, OS auto-launch,
 * and powerSaveBlocker keep-awake. Persists into IAppSettings via ELECTRON_PLUGIN_CONFIG_KEY.
 *
 * Registered to ISettingsTabRegistryService by ElectronRendererPlugin's onReady so
 * the tab only appears in the desktop shell — web and mobile shells never mount
 * ElectronRendererPlugin and therefore never register this tab.
 */
export function PlatformTab() {
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);

  const [appSettings, setAppSettings] = useState<IAppSettings>(() => normalizeAppSettings(null));

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
        // eslint-disable-next-line no-console
        console.error('[PlatformTab] Failed to load app settings:', err);
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
      {/* System Tray */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader
          className={cn('tm:bg-black/10 tm:py-3', {
            'tm:border-b tm:border-line tm:pb-3': appSettings.trayEnabled,
          })}
        >
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <FieldLabel htmlFor="settings-tray-enabled" className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t('electron-renderer.platform-tab.tray-enable')}
              </FieldLabel>
              <Switch
                id="settings-tray-enabled"
                checked={appSettings.trayEnabled}
                onCheckedChange={(checked) => updateAppSettings({ trayEnabled: checked })}
              />
            </div>
            <CardDescription className="tm:text-xs">
              {localeService.t('electron-renderer.platform-tab.tray-enable-description')}
            </CardDescription>
          </div>
        </CardHeader>

        {appSettings.trayEnabled && (
          <CardContent>
            <FieldGroup className="tm:my-4 tm:gap-4">
              <Field orientation="horizontal" className="tm:items-start">
                <FieldLabel htmlFor="settings-close-to-tray" className={horizontalFieldLabelCls}>
                  <span className="tm:text-sm tm:font-normal">
                    {localeService.t('electron-renderer.platform-tab.close-to-tray')}
                  </span>
                  <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                    {localeService.t('electron-renderer.platform-tab.close-to-tray-description')}
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

      {/* OS Auto-Launch */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <h3 className="tm:text-sm tm:font-semibold tm:text-white">
            {localeService.t('electron-renderer.platform-tab.startup-title')}
          </h3>
        </CardHeader>
        <CardContent>
          <FieldGroup className="tm:my-4 tm:gap-4">
            <Field orientation="horizontal" className="tm:items-start">
              <FieldLabel htmlFor="settings-auto-launch" className={horizontalFieldLabelCls}>
                <span className="tm:text-sm tm:font-normal">
                  {localeService.t('electron-renderer.platform-tab.auto-launch')}
                </span>
                <span className="tm:text-xs tm:font-normal tm:text-grey-fg">
                  {localeService.t('electron-renderer.platform-tab.auto-launch-description')}
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

      {/* Keep Screen Awake (powerSaveBlocker) */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:bg-black/10 tm:py-3">
          <div className="tm:flex tm:min-w-0 tm:flex-col tm:gap-1.5">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-4">
              <FieldLabel htmlFor="settings-keep-awake" className="tm:text-sm tm:font-semibold tm:text-white">
                {localeService.t('electron-renderer.platform-tab.keep-awake-title')}
              </FieldLabel>
              <Switch
                id="settings-keep-awake"
                checked={appSettings.keepAwakeWhileAgentActive}
                onCheckedChange={(checked) => updateAppSettings({ keepAwakeWhileAgentActive: checked })}
              />
            </div>
            <CardDescription className="tm:text-xs">
              {localeService.t('electron-renderer.platform-tab.keep-awake-description')}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </FieldGroup>
  );
}
