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
import { Core, LocaleType, LogLevel, merge } from '@termlnk/core';
import { ElectronPlugin } from '@termlnk/electron';
import { ElectronRendererPlugin, UpdaterUIPlugin } from '@termlnk/electron-renderer';
import { ExtensionPlugin } from '@termlnk/extension';
import { ExtensionUIPlugin } from '@termlnk/extension-ui';
import { RPCPlugin } from '@termlnk/rpc';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { SettingsUIPlugin } from '@termlnk/settings-ui';
import { SFTPUIPlugin } from '@termlnk/sftp-ui';
import { TerminalPlugin } from '@termlnk/terminal';
import { TerminalUIPlugin } from '@termlnk/terminal-ui';
import { chadracula } from '@termlnk/themes';
import { UIPlugin } from '@termlnk/ui';
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
  core.registerPlugin(UIPlugin, {
    container: ref!,
  });
  core.registerPlugin(ElectronPlugin);
  core.registerPlugin(ElectronRendererPlugin);
  core.registerPlugin(UpdaterUIPlugin);
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
