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

import type { IMobilePreferences } from '@termlnk/database-mobile';
import type { ReactNode } from 'react';
import { VariableContextProvider } from 'nativewind';
import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { resolveEffectiveMode } from './theme-resolver';
import { useObservable, usePreferencesService } from '../core/core-context';

// Semantic chrome color tokens fed to NativeWind's VariableContextProvider.
//
// Keys MUST match the CSS custom properties Tailwind emits for the semantic
// utilities: `bg-surface` compiles to `var(--color-surface)`, so the runtime
// variable to override is `--color-surface`. react-native-css strips the
// leading `--` on both the provider key and the var() lookup, so `--color-*`
// keys here resolve correctly; bare names like `surface` would NOT.
//
// Values mirror the two palettes declared in global.css: LIGHT is the Termius
// management chrome, DARK is Base46 onedark.
type IThemeVars = Readonly<Record<string, string>>;

export const LIGHT_VARS: IThemeVars = {
  '--color-surface': '#eceef0',
  '--color-surface-raised': '#ffffff',
  '--color-surface-sunken': '#e2e4e8',
  '--color-content': '#10233f',
  '--color-content-secondary': '#5b6573',
  '--color-content-tertiary': '#9aa3af',
  '--color-divider': '#dfe2e6',
  '--color-accent': '#3b7bf6',
  '--color-accent-content': '#ffffff',
  '--color-danger': '#d7373f',
  '--color-tabbar': '#ffffff',
  '--color-field': '#ffffff',
};

export const DARK_VARS: IThemeVars = {
  '--color-surface': '#1e222a',
  '--color-surface-raised': '#282c34',
  '--color-surface-sunken': '#1b1f27',
  '--color-content': '#d7dae0',
  '--color-content-secondary': '#9aa0aa',
  '--color-content-tertiary': '#6b727f',
  '--color-divider': '#31353d',
  '--color-accent': '#61afef',
  '--color-accent-content': '#1e222a',
  '--color-danger': '#e06c75',
  '--color-tabbar': '#252931',
  '--color-field': '#2d313a',
};

interface IThemeProviderProps {
  readonly children: ReactNode;
}

// Active resolved mode, so non-className consumers (lucide icon `color` props,
// which are not Tailwind-styleable) can pick the matching hex. Defaults to null
// so useThemeMode falls back to the OS scheme outside any provider.
const ThemeModeContext = createContext<'light' | 'dark' | null>(null);

/**
 * Reads the user's themeMode preference and the current OS color scheme, then
 * exposes the resolved mode ('light'/'dark') to descendants through both a
 * NativeWind CSS variable context and a React context (for hex consumers).
 *
 * Must be rendered inside {@link CoreProvider} and after
 * {@link PreferencesBootGate} — the prefs service must be `ready()` by the
 * time this component subscribes.
 */
export function ThemeProvider({ children }: IThemeProviderProps) {
  const prefsService = usePreferencesService();
  const prefs = useObservable<IMobilePreferences>(prefsService.prefs$, prefsService.get());
  // react-native's useColorScheme subscribes to Appearance and re-renders on
  // OS theme changes; nativewind's own hook is deprecated in v5.
  const scheme = useColorScheme();
  const mode = resolveEffectiveMode(prefs.themeMode, scheme === 'dark' ? 'dark' : 'light');
  const value = mode === 'dark' ? DARK_VARS : LIGHT_VARS;
  return (
    <ThemeModeContext.Provider value={mode}>
      <VariableContextProvider value={value}>{children}</VariableContextProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): 'light' | 'dark' {
  const ctx = useContext(ThemeModeContext);
  const scheme = useColorScheme();
  if (ctx != null) {
    return ctx;
  }
  return scheme === 'dark' ? 'dark' : 'light';
}

// Resolved hex palette derived from the VARS maps (single source of truth).
// Use for lucide icon `color` props and other non-className tints.
export interface IThemeColors {
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceSunken: string;
  readonly content: string;
  readonly contentSecondary: string;
  readonly contentTertiary: string;
  readonly divider: string;
  readonly accent: string;
  readonly accentContent: string;
  readonly danger: string;
  readonly tabbar: string;
  readonly field: string;
}

function toColors(vars: IThemeVars): IThemeColors {
  return {
    surface: vars['--color-surface'],
    surfaceRaised: vars['--color-surface-raised'],
    surfaceSunken: vars['--color-surface-sunken'],
    content: vars['--color-content'],
    contentSecondary: vars['--color-content-secondary'],
    contentTertiary: vars['--color-content-tertiary'],
    divider: vars['--color-divider'],
    accent: vars['--color-accent'],
    accentContent: vars['--color-accent-content'],
    danger: vars['--color-danger'],
    tabbar: vars['--color-tabbar'],
    field: vars['--color-field'],
  };
}

const LIGHT_COLORS = toColors(LIGHT_VARS);
const DARK_COLORS = toColors(DARK_VARS);

export function useThemeColors(): IThemeColors {
  return useThemeMode() === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}
