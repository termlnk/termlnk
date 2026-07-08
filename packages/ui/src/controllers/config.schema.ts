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

import type { DependencyOverride } from '@termlnk/core';
import type { IWorkbenchOptions } from './ui/ui.controller';

export const UI_PLUGIN_CONFIG_KEY = 'ui.config';

export const configSymbol = Symbol(UI_PLUGIN_CONFIG_KEY);

export const DEFAULT_UI_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const DEFAULT_UI_FONT_SIZE = 14;

export interface IUIConfig extends IWorkbenchOptions {
  override?: DependencyOverride;
  fontFamily?: string;
  fontSize?: number;

  /**
   * Theme mode. Drives the theme-mode resolver together with the OS scheme.
   */
  themeMode?: 'auto' | 'dark' | 'light';

  /**
   * Theme name used when the resolved mode is 'dark' (either explicit or
   * derived from OS scheme in 'auto').
   */
  darkThemeName?: string;

  /**
   * Theme name used when the resolved mode is 'light'.
   */
  lightThemeName?: string;

  /**
   * @deprecated Legacy single-slot theme name. Kept for read-through migration
   * only — never written by new code. Do not delete: rollback safety.
   */
  theme?: string;

  locale?: string;
}

export const defaultPluginConfig: IUIConfig = {};
