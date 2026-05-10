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
import { RPCPlugin } from '@termlnk/rpc';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { SettingsUIPlugin } from '@termlnk/settings-ui';
import { SFTPUIPlugin } from '@termlnk/sftp-ui';
import { SyncPlugin } from '@termlnk/sync';
import { SyncUIPlugin } from '@termlnk/sync-ui';
import { TerminalPlugin } from '@termlnk/terminal';
import { TerminalUIPlugin } from '@termlnk/terminal-ui';
import { chadracula } from '@termlnk/themes';
import { UIPlugin } from '@termlnk/ui';
import { WebRendererPlugin } from '@termlnk/web-renderer';
import { enUS, jaJP, koKR, zhCN, zhTW } from './locales';
import '@termlnk/design/global.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@xterm/xterm/css/xterm.css';
import '@termlnk/ui/global.css';
import '@termlnk/terminal-ui/global.css';
import '@termlnk/sftp-ui/global.css';
import '@termlnk/settings-ui/global.css';
import '@termlnk/extension-ui/global.css';
import '@termlnk/agent-ui/global.css';

export interface ICreateTermlnkConfig extends ICoreConfig {
  terminalUIConfig?: ITerminalUIConfig;
}

// Mirrors apps/desktop/renderer/src/components/core.tsx, with three swaps
// driven by cloud-sync-architecture.md §7.2.3 / §7.2.4:
// 1. Drop ElectronPlugin / ElectronRendererPlugin — those rely on Electron
//    preload bridges that do not exist in the browser.
// 2. Add WebRendererPlugin, which registers WebRPCClientService (httpBatchLink
//    + wsLink instead of ipcLink), a Noop window manager, and a real
//    WebUpdaterService that polls GitHub Releases for "new version available"
//    hints (download / install rejected — operators update by pulling a new
//    docker image). UIPlugin's UpdaterUIController picks up that binding and
//    renders the sidebar button + dialog with the same components used on
//    desktop.
// 3. Skip island plugins entirely — the dynamic-island secondary window is an
//    Electron-only concept; the web SPA has only the main workbench surface.
export function createCore(ref: string | HTMLElement, options?: Partial<ICreateTermlnkConfig>) {
  const {
    terminalUIConfig,
    ...restOptions
  } = options || {};

  const defaultOptions: Partial<ICoreConfig> = merge(
    {
      theme: chadracula,
      logLevel: LogLevel.INFO,
      locale: LocaleType.EN_US,
      locales: { enUS, zhCN, jaJP, koKR, zhTW },
    },
    restOptions
  );
  const core = new Core(defaultOptions);
  core.registerPlugin(RPCPlugin);
  core.registerPlugin(RPCClientPlugin);
  // Register NetworkPlugin so HTTPService is available for browser-side
  // direct HTTP calls (WebUpdaterService GitHub poll, WebShell session
  // checks). The browser SPA leaves IFetchProvider on its DefaultFetchProvider
  // — proxy injection is a node-only concern handled in the desktop main /
  // server bootstrap.
  core.registerPlugin(NetworkPlugin, { useFetchImpl: true });
  core.registerPlugin(AuthPlugin);
  core.registerPlugin(AuthUIPlugin);
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(SyncUIPlugin);
  core.registerPlugin(UIPlugin, {
    container: ref!,
  });
  core.registerPlugin(WebRendererPlugin);
  core.registerPlugin(TerminalPlugin);
  core.registerPlugin(TerminalUIPlugin, terminalUIConfig);
  core.registerPlugin(SFTPUIPlugin);
  core.registerPlugin(SettingsUIPlugin);
  core.registerPlugin(ExtensionPlugin);
  core.registerPlugin(ExtensionUIPlugin);
  core.registerPlugin(AgentUIPlugin);
  core.start();
  return core;
}
