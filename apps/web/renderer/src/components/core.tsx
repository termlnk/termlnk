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

import type { ICoreConfig } from '@termlnk/core';
import type { ITerminalUIConfig } from '@termlnk/terminal-ui';
import { AgentUIPlugin } from '@termlnk/agent-ui';
import { AuthPlugin } from '@termlnk/auth';
import { AuthUIPlugin } from '@termlnk/auth-ui';
import { Core, LocaleType, LogLevel, merge } from '@termlnk/core';
import { ExtensionPlugin } from '@termlnk/extension';
import { ExtensionUIPlugin } from '@termlnk/extension-ui';
import { NetworkPlugin } from '@termlnk/network';
import { PortForwardingUIPlugin } from '@termlnk/port-forwarding-ui';
import { RPCPlugin } from '@termlnk/rpc';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { SettingsUIPlugin } from '@termlnk/settings-ui';
import { SFTPUIPlugin } from '@termlnk/sftp-ui';
import { SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { SharedTerminalUIPlugin } from '@termlnk/shared-terminal-ui';
import { SnippetUIPlugin } from '@termlnk/snippet-ui';
import { SyncPlugin } from '@termlnk/sync';
import { SyncUIPlugin } from '@termlnk/sync-ui';
import { TerminalPlugin } from '@termlnk/terminal';
import { TerminalUIPlugin } from '@termlnk/terminal-ui';
import { ALL_THEMES, termlnkDark, termlnkLight } from '@termlnk/themes';
import { DEFAULT_DARK_THEME_NAME, DEFAULT_LIGHT_THEME_NAME, resolveEffectiveThemeName, UIPlugin } from '@termlnk/ui';
import { WebRendererPlugin } from '@termlnk/web-renderer';
import { enUS, jaJP, koKR, zhCN, zhTW } from './locales';
import '@termlnk/design/global.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@xterm/xterm/css/xterm.css';
import '@termlnk/ui/global.css';
import '@termlnk/terminal-ui/global.css';
import '@termlnk/sftp-ui/global.css';
import '@termlnk/port-forwarding-ui/global.css';
import '@termlnk/settings-ui/global.css';
import '@termlnk/extension-ui/global.css';
import '@termlnk/agent-ui/global.css';
import '@termlnk/web-renderer/global.css';

export interface ICreateTermlnkConfig extends ICoreConfig {
  terminalUIConfig?: ITerminalUIConfig;
}

interface IBootUIConfig {
  readonly themeMode?: 'auto' | 'dark' | 'light';
  readonly darkThemeName?: string;
  readonly lightThemeName?: string;
  readonly theme?: string;
}

/**
 * Fetches persisted UI config from the web server's `/boot/ui-config` endpoint
 * and picks the initial theme before Core is constructed. Mirrors the
 * Electron preload IPC (`__TERMLNK_BOOT__.getUIConfig`) — same purpose, HTTP
 * transport. Fails soft: if the fetch errors (e.g. server slow to boot), we
 * fall back to matchMedia + built-in defaults so first paint is still correct
 * for auto-mode users.
 */
async function seedInitialTheme() {
  const bootConfig = await fetchBootConfig();
  const osScheme = readOSColorScheme();

  const mode = bootConfig?.themeMode ?? inferModeFromLegacy(bootConfig?.theme) ?? 'auto';
  const darkName = bootConfig?.darkThemeName ?? DEFAULT_DARK_THEME_NAME;
  const lightName = bootConfig?.lightThemeName ?? DEFAULT_LIGHT_THEME_NAME;
  const effectiveName = resolveEffectiveThemeName(mode, osScheme, darkName, lightName);

  return findBuiltinTheme(effectiveName) ?? (osScheme === 'dark' ? termlnkDark : termlnkLight);
}

async function fetchBootConfig(): Promise<IBootUIConfig | null> {
  try {
    const resp = await fetch('/boot/ui-config', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    if (!resp.ok) {
      return null;
    }
    return await resp.json() as IBootUIConfig | null;
  } catch {
    return null;
  }
}

function readOSColorScheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function inferModeFromLegacy(legacyTheme: string | undefined): 'auto' | 'dark' | 'light' | null {
  if (!legacyTheme) {
    return null;
  }
  const theme = findBuiltinTheme(legacyTheme);
  return theme ? theme.type : null;
}

function findBuiltinTheme(name: string) {
  return ALL_THEMES.find((t) => t.name === name);
}

export async function createCore(ref: string | HTMLElement, options?: Partial<ICreateTermlnkConfig>): Promise<Core> {
  const {
    terminalUIConfig,
    ...restOptions
  } = options || {};

  const initialTheme = await seedInitialTheme();

  const defaultOptions: Partial<ICoreConfig> = merge(
    {
      theme: initialTheme,
      logLevel: LogLevel.INFO,
      locale: LocaleType.EN_US,
      locales: { enUS, zhCN, jaJP, koKR, zhTW },
    },
    restOptions
  );
  const core = new Core(defaultOptions);
  core.registerPlugin(RPCPlugin);
  core.registerPlugin(RPCClientPlugin);
  core.registerPlugin(UIPlugin, {
    container: ref!,
  });
  core.registerPlugin(NetworkPlugin, { useFetchImpl: true });
  core.registerPlugin(WebRendererPlugin);
  core.registerPlugin(AuthPlugin);
  core.registerPlugin(AuthUIPlugin);
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(SyncUIPlugin);
  core.registerPlugin(TerminalPlugin);
  core.registerPlugin(TerminalUIPlugin, terminalUIConfig);
  core.registerPlugin(SharedTerminalPlugin);
  core.registerPlugin(SharedTerminalUIPlugin);
  core.registerPlugin(SFTPUIPlugin);
  core.registerPlugin(PortForwardingUIPlugin);
  core.registerPlugin(SnippetUIPlugin);
  core.registerPlugin(SettingsUIPlugin);
  core.registerPlugin(ExtensionPlugin);
  core.registerPlugin(ExtensionUIPlugin);
  core.registerPlugin(AgentUIPlugin);
  core.start();
  return core;
}
