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

import type { ThemeMode } from '@termlnk/database-mobile';

/**
 * Pure resolver from user preference + OS scheme to the concrete rendered mode.
 * Kept in sync with `resolveEffectiveThemeType` in @termlnk/ui so mobile and
 * desktop/web behaviour matches when only Base46 palettes are considered.
 */
export function resolveEffectiveMode(mode: ThemeMode, osScheme: 'dark' | 'light'): 'dark' | 'light' {
  if (mode === 'dark') {
    return 'dark';
  }
  if (mode === 'light') {
    return 'light';
  }
  return osScheme;
}

/**
 * Pure resolver from user preference + OS scheme to the effective theme name
 * that should feed base46ToXterm. Mirrors resolveEffectiveThemeName in
 * @termlnk/ui but stays inline here so the mobile subtree doesn't take an
 * extra dependency on the desktop ui package.
 */
export function resolveEffectiveThemeName(
  mode: ThemeMode,
  osScheme: 'dark' | 'light',
  darkThemeName: string,
  lightThemeName: string
): string {
  return resolveEffectiveMode(mode, osScheme) === 'dark' ? darkThemeName : lightThemeName;
}
