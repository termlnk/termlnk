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
import type { ThemeMode } from '@termlnk/ui';
import { LocaleService } from '@termlnk/core';
import { Card, CardAction, CardContent, CardDescription, CardHeader, ToggleGroup, ToggleGroupItem, useDependency, useObservable } from '@termlnk/design';
import { ALL_THEMES } from '@termlnk/themes';
import { ThemePicker } from '@termlnk/themes-ui';
import { IThemeModeService, IThemeRegistryService } from '@termlnk/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useCallback, useMemo } from 'react';

const MODE_TOGGLE_ITEM_CLASS = `
  tm:gap-2 tm:text-white
  tm:data-[state=off]:hover:bg-blue/25 tm:data-[state=off]:hover:text-white
  tm:data-[state=on]:bg-blue/90 tm:data-[state=on]:text-[#ffffff] tm:data-[state=on]:hover:text-[#ffffff]
`;

export function ColorSchemeTab() {
  const themeModeService = useDependency(IThemeModeService);
  const themeRegistry = useDependency(IThemeRegistryService);
  const localeService = useDependency(LocaleService);

  const mode = useObservable<ThemeMode>(themeModeService.mode$, themeModeService.mode);
  const darkThemeName = useObservable<string>(themeModeService.darkThemeName$, themeModeService.darkThemeName);
  const lightThemeName = useObservable<string>(themeModeService.lightThemeName$, themeModeService.lightThemeName);

  const darkThemes = useMemo(() => ALL_THEMES.filter((t) => t.type === 'dark'), []);
  const lightThemes = useMemo(() => ALL_THEMES.filter((t) => t.type === 'light'), []);

  const darkTheme = useMemo<ITheme | null>(
    () => (darkThemeName ? themeRegistry.resolveTheme(darkThemeName) : null),
    [darkThemeName, themeRegistry]
  );
  const lightTheme = useMemo<ITheme | null>(
    () => (lightThemeName ? themeRegistry.resolveTheme(lightThemeName) : null),
    [lightThemeName, themeRegistry]
  );

  const handleModeChange = useCallback(
    (next: string): void => {
      if (next !== 'auto' && next !== 'dark' && next !== 'light') {
        return;
      }
      void themeModeService.setMode(next).catch(() => { /* surfaced via notification */ });
    },
    [themeModeService]
  );

  const handleDarkChange = useCallback(
    (theme: ITheme): void => {
      void themeModeService.setDarkTheme(theme.name).catch(() => { /* surfaced via notification */ });
    },
    [themeModeService]
  );

  const handleLightChange = useCallback(
    (theme: ITheme): void => {
      void themeModeService.setLightTheme(theme.name).catch(() => { /* surfaced via notification */ });
    },
    [themeModeService]
  );

  return (
    <div className="tm:flex tm:flex-col tm:gap-6">
      {/* Mode selector */}
      <Card>
        <CardHeader>
          <h3 className="tm:text-base tm:font-semibold tm:text-white">
            {localeService.t('settings-ui.color-scheme.mode-title')}
          </h3>
          <CardDescription className="tm:mt-2 tm:text-xs/5">
            {localeService.t('settings-ui.color-scheme.mode-description')}
          </CardDescription>
          <CardAction className="tm:self-center">
            <ToggleGroup
              type="single"
              value={mode ?? 'auto'}
              onValueChange={handleModeChange}
              spacing={4}
            >
              <ToggleGroupItem value="auto" className={MODE_TOGGLE_ITEM_CLASS}>
                <Monitor className="tm:size-4" />
                {localeService.t('settings-ui.color-scheme.mode-auto')}
              </ToggleGroupItem>
              <ToggleGroupItem value="light" className={MODE_TOGGLE_ITEM_CLASS}>
                <Sun className="tm:size-4" />
                {localeService.t('settings-ui.color-scheme.mode-light')}
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" className={MODE_TOGGLE_ITEM_CLASS}>
                <Moon className="tm:size-4" />
                {localeService.t('settings-ui.color-scheme.mode-dark')}
              </ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
      </Card>

      {/* Dark themes */}
      <Card className="tm:gap-0 tm:py-0">
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
            currentTheme={darkTheme}
            onThemeChange={handleDarkChange}
          />
        </CardContent>
      </Card>

      {/* Light themes */}
      <Card className="tm:gap-0 tm:py-0">
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
            currentTheme={lightTheme}
            onThemeChange={handleLightChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
