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
import { IThemeService, LocaleService } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, useDependency, useObservable } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { ALL_THEMES } from '@termlnk/themes';
import { ThemePicker } from '@termlnk/themes-ui';
import { UI_PLUGIN_CONFIG_KEY } from '@termlnk/ui';
import { Moon, Sun } from 'lucide-react';
import { useCallback, useMemo } from 'react';

export function ColorSchemeTab() {
  const themeService = useDependency(IThemeService);
  const localeService = useDependency(LocaleService);
  const configManagerService = useDependency(IConfigManagerService);
  const currentTheme = useObservable<ITheme | null>(themeService.currentTheme$, null);

  const darkThemes = useMemo(() => ALL_THEMES.filter((t) => t.type === 'dark'), []);
  const lightThemes = useMemo(() => ALL_THEMES.filter((t) => t.type === 'light'), []);

  const handleThemeChange = useCallback(
    (theme: ITheme) => {
      themeService.setTheme(theme);
      void configManagerService.setField(UI_PLUGIN_CONFIG_KEY, 'theme', theme.name).catch(() => { });
    },
    [themeService, configManagerService]
  );

  return (
    <div className="tm:flex tm:flex-col tm:gap-6">
      {/* Dark themes */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <div className="tm:flex tm:items-center tm:gap-2">
            <Moon className="tm:size-4 tm:text-grey-fg2" />
            <h3 className="tm:text-base tm:font-semibold tm:text-white">
              {localeService.t('settings-ui.color-scheme.dark-theme-title')}
            </h3>
          </div>
          <CardDescription className="tm:mt-2 tm:text-xs/5">
            {localeService.t('settings-ui.color-scheme.dark-theme-description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="tm:py-4">
          <ThemePicker
            themes={darkThemes}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
          />
        </CardContent>
      </Card>

      {/* Light themes */}
      <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
        <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
          <div className="tm:flex tm:items-center tm:gap-2">
            <Sun className="tm:size-4 tm:text-grey-fg2" />
            <h3 className="tm:text-base tm:font-semibold tm:text-white">
              {localeService.t('settings-ui.color-scheme.light-theme-title')}
            </h3>
          </div>
          <CardDescription className="tm:mt-2 tm:text-xs/5">
            {localeService.t('settings-ui.color-scheme.light-theme-description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="tm:py-4">
          <ThemePicker
            themes={lightThemes}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
