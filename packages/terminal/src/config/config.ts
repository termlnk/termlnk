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

import { Platform, platform } from '@termlnk/core';

export const DEFAULT_HOST_ROOT = 'root';

export interface IWindowTransparencyConfig {
  enabled: boolean;
  opacity: number; // 0.3 - 1.0
}

export const DEFAULT_WINDOW_TRANSPARENCY_OPACITY = 0.85;

export interface IEncodingItem {
  value: string;
  label: string;
}

export interface IEncodingGroup {
  label: string;
  items: IEncodingItem[];
}

export const DEFAULT_FONT_FAMILY = '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace';
export const DEFAULT_FONT_SIZE = 12;
export const DEFAULT_LETTER_SPACING = 0;
export const DEFAULT_TERM_TYPE = 'xterm-256color';
export const DEFAULT_CONNECT_TIMEOUT = 30000;
export const DEFAULT_CONNECT_HEARTBEAT = 10000;
export const DEFAULT_ENCODE = 'utf-8';
export const DEFAULT_PERSISTENCE_SCROLLBACK = 500;

export type CursorStyle = 'bar' | 'block' | 'underline';
export type TerminalRendererEngine = 'dom' | 'webgl';
export type LocalTerminalShell = string;

export interface ILocalTerminalShellOption {
  value: LocalTerminalShell;
  label: string;
}

export const DEFAULT_CURSOR_STYLE: CursorStyle = 'bar';
export const DEFAULT_CURSOR_BLINK = true;
export const DEFAULT_TERMINAL_RENDERER_ENGINE: TerminalRendererEngine = 'dom';
export const DEFAULT_TERMINAL_WORD_SEPARATOR = './\\()"\'-:,.;<>~!@#$%^&*|+=[]{}`~ ?';
export const DEFAULT_CTRL_OR_META_OPEN_TERMINAL_LINK = false;
export const DEFAULT_LOCAL_TERMINAL_SHELL: LocalTerminalShell = 'system';
export const DEFAULT_WINDOWS_LOCAL_TERMINAL_SHELL: LocalTerminalShell = 'powershell';

export interface ITerminalAppearanceConfig {
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  rendererEngine: TerminalRendererEngine;
  persistentSession: boolean;
  persistentSessionScrollback: number;
  ctrlOrMetaOpenTerminalLink: boolean;
}

export interface ILocalTerminalConfig {
  defaultShell: LocalTerminalShell;
}

function normalizeLocalTerminalShellValue(value: unknown, fallback: LocalTerminalShell): LocalTerminalShell {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0
    ? normalizedValue
    : fallback;
}

export function getDefaultLocalTerminalConfig(currentPlatform: Platform = platform): ILocalTerminalConfig {
  if (currentPlatform === Platform.Windows) {
    return {
      defaultShell: DEFAULT_WINDOWS_LOCAL_TERMINAL_SHELL,
    };
  }

  return {
    defaultShell: DEFAULT_LOCAL_TERMINAL_SHELL,
  };
}

export function normalizeLocalTerminalConfig(
  value: Partial<ILocalTerminalConfig> | null,
  currentPlatform: Platform = platform
): ILocalTerminalConfig {
  const defaults = getDefaultLocalTerminalConfig(currentPlatform);
  if (!value) {
    return defaults;
  }

  return {
    defaultShell: normalizeLocalTerminalShellValue(value.defaultShell, defaults.defaultShell),
  };
}

export function getShellExecutableName(shellValue: string): string {
  const lastSlash = Math.max(shellValue.lastIndexOf('/'), shellValue.lastIndexOf('\\'));
  return shellValue
    .slice(lastSlash + 1)
    .replace(/\.exe$/i, '')
    .toLowerCase();
}

export function createMissingShellOption(
  shellValue: LocalTerminalShell,
  systemLabel: string,
  powershellLabel: string,
  commandPromptLabel: string
): ILocalTerminalShellOption {
  switch (shellValue) {
    case 'system':
      return { value: shellValue, label: systemLabel };
    case 'powershell':
      return { value: shellValue, label: powershellLabel };
    case 'command-prompt':
      return { value: shellValue, label: commandPromptLabel };
    default: {
      const executableName = getShellExecutableName(shellValue);
      return {
        value: shellValue,
        label: executableName.length > 0 ? executableName : shellValue,
      };
    }
  }
}

export function resolveLegacyShellValue(
  shellValue: LocalTerminalShell,
  options: ILocalTerminalShellOption[]
): LocalTerminalShell | null {
  const executableName = getShellExecutableName(shellValue);

  if (shellValue === 'powershell' || executableName === 'powershell' || executableName === 'pwsh') {
    return options.find((option) => option.value === 'powershell')
      ?.value
      || options.find((option) => getShellExecutableName(option.value) === 'pwsh')
        ?.value
      || options.find((option) => getShellExecutableName(option.value) === 'powershell')
        ?.value
      || null;
  }

  if (shellValue === 'command-prompt' || executableName === 'cmd') {
    return options.find((option) => option.value === 'command-prompt')
      ?.value
      || options.find((option) => getShellExecutableName(option.value) === 'cmd')
        ?.value
      || null;
  }

  return null;
}

export const ENCODING_GROUPS: IEncodingGroup[] = [
  {
    label: 'Unicode',
    items: [
      { value: 'utf-8', label: 'UTF-8' },
    ],
  },
  {
    label: '中文',
    items: [
      { value: 'gbk', label: 'GBK' },
      { value: 'gb2312', label: 'GB2312' },
      { value: 'gb18030', label: 'GB18030' },
      { value: 'big5', label: 'Big5' },
    ],
  },
  {
    label: '日本語',
    items: [
      { value: 'shift_jis', label: 'Shift_JIS' },
      { value: 'euc-jp', label: 'EUC-JP' },
      { value: 'iso-2022-jp', label: 'ISO-2022-JP' },
    ],
  },
  {
    label: '한국어',
    items: [
      { value: 'euc-kr', label: 'EUC-KR' },
    ],
  },
  {
    label: 'Western',
    items: [
      { value: 'iso-8859-1', label: 'ISO-8859-1' },
      { value: 'iso-8859-15', label: 'ISO-8859-15' },
      { value: 'windows-1252', label: 'Windows-1252' },
    ],
  },
  {
    label: 'Central European',
    items: [
      { value: 'iso-8859-2', label: 'ISO-8859-2' },
      { value: 'windows-1250', label: 'Windows-1250' },
    ],
  },
  {
    label: 'Cyrillic',
    items: [
      { value: 'iso-8859-5', label: 'ISO-8859-5' },
      { value: 'windows-1251', label: 'Windows-1251' },
      { value: 'koi8-r', label: 'KOI8-R' },
      { value: 'koi8-u', label: 'KOI8-U' },
    ],
  },
  {
    label: 'Greek',
    items: [
      { value: 'iso-8859-7', label: 'ISO-8859-7' },
      { value: 'windows-1253', label: 'Windows-1253' },
    ],
  },
  {
    label: 'Turkish',
    items: [
      { value: 'iso-8859-9', label: 'ISO-8859-9' },
      { value: 'windows-1254', label: 'Windows-1254' },
    ],
  },
  {
    label: 'Arabic',
    items: [
      { value: 'iso-8859-6', label: 'ISO-8859-6' },
      { value: 'windows-1256', label: 'Windows-1256' },
    ],
  },
  {
    label: 'Hebrew',
    items: [
      { value: 'iso-8859-8', label: 'ISO-8859-8' },
      { value: 'windows-1255', label: 'Windows-1255' },
    ],
  },
  {
    label: 'Thai',
    items: [
      { value: 'windows-874', label: 'Windows-874' },
    ],
  },
  {
    label: 'Vietnamese',
    items: [
      { value: 'windows-1258', label: 'Windows-1258' },
    ],
  },
];
