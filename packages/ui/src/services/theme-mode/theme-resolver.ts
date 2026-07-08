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

import type { OSColorScheme } from '../color-scheme/color-scheme.service';

export type ThemeMode = 'auto' | 'dark' | 'light';

export const DEFAULT_DARK_THEME_NAME = 'termlnk-dark';
export const DEFAULT_LIGHT_THEME_NAME = 'termlnk-light';

/**
 * Pure resolver from user preferences to the effective theme name.
 *
 * Callers must translate the name back to an ITheme via IThemeRegistryService,
 * which handles built-in + extension-contributed themes together.
 */
export function resolveEffectiveThemeName(
  mode: ThemeMode,
  scheme: OSColorScheme,
  darkThemeName: string,
  lightThemeName: string
): string {
  if (mode === 'dark') {
    return darkThemeName;
  }
  if (mode === 'light') {
    return lightThemeName;
  }
  return scheme === 'dark' ? darkThemeName : lightThemeName;
}

/**
 * Pure resolver from mode + OS scheme to the effective ThemeType. Mobile
 * consumers (which drive NativeWind chrome vars) also use this.
 */
export function resolveEffectiveThemeType(mode: ThemeMode, scheme: OSColorScheme): OSColorScheme {
  if (mode === 'dark') {
    return 'dark';
  }
  if (mode === 'light') {
    return 'light';
  }
  return scheme;
}
