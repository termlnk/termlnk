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

import type { ITheme } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { ThemeMode } from './theme-resolver';
import { createIdentifier } from '@termlnk/core';

/**
 * Renderer-local service that owns the theme *mode* state (auto/dark/light)
 * and the two theme-slot preferences (dark slot / light slot). It fans in from
 * OS scheme + user prefs and pushes the resolved ITheme to IThemeService.
 *
 * Contract identifier lives in @termlnk/ui (no rpc-client / extension-ui
 * dependency); the concrete implementation lives in @termlnk/settings-ui,
 * which already owns the config-manager wiring.
 */
export interface IThemeModeService {
  readonly mode$: Observable<ThemeMode>;
  readonly mode: ThemeMode;

  readonly darkThemeName$: Observable<string>;
  readonly darkThemeName: string;

  readonly lightThemeName$: Observable<string>;
  readonly lightThemeName: string;

  readonly effectiveTheme$: Observable<ITheme | null>;

  setMode(mode: ThemeMode): Promise<void>;
  setDarkTheme(themeName: string): Promise<void>;
  setLightTheme(themeName: string): Promise<void>;
}
export const IThemeModeService = createIdentifier<IThemeModeService>('ui.theme-mode-service');
