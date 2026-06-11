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

import type { ITheme as IBase46Theme, IXtermTheme } from '@termlnk/themes';
import { ALL_THEMES, base46ToXterm } from '@termlnk/themes';

export type { IBase46Theme, IXtermTheme };

export interface ITerminalThemePreview {
  readonly bg: string;
  readonly fg: string;
  readonly ansi: readonly string[];
}

export interface ITerminalThemeOption {
  readonly id: string;
  readonly name: string;
  readonly mode: 'light' | 'dark';
  readonly xterm: IXtermTheme;
  readonly preview: ITerminalThemePreview;
}

const ANSI_KEYS = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const;

export function mapBase46ToXterm(theme: IBase46Theme): IXtermTheme {
  return base46ToXterm(theme);
}

export function listTerminalThemes(): ITerminalThemeOption[] {
  return ALL_THEMES.map((theme) => {
    const xterm = mapBase46ToXterm(theme);
    return {
      id: theme.name,
      name: theme.displayName,
      mode: theme.type,
      xterm,
      preview: {
        bg: xterm.background,
        fg: xterm.foreground,
        ansi: ANSI_KEYS.map((key) => xterm[key]),
      },
    };
  });
}
