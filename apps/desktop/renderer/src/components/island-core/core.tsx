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
import { Core, LocaleType, LogLevel, merge } from '@termlnk/core';
import { ElectronPlugin } from '@termlnk/electron';
import { ElectronRendererPlugin } from '@termlnk/electron-renderer';
import { IslandPlugin } from '@termlnk/island';
import { IslandUIPlugin } from '@termlnk/island-ui';
import { RPCPlugin } from '@termlnk/rpc';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { enUS, jaJP, koKR, zhCN, zhTW } from '../locales';
import '@termlnk/island-ui/global.css';

export interface ICreateIslandConfig extends ICoreConfig {
  terminalUIConfig?: ITerminalUIConfig;
}

export function createCore(ref: HTMLElement, options?: Partial<ICreateIslandConfig>) {
  const {
    terminalUIConfig,
    ...restOptions
  } = options || {};

  const defaultOptions: Partial<ICoreConfig> = merge(
    {
      logLevel: LogLevel.INFO,
      locale: LocaleType.EN_US,
      locales: { enUS, zhCN, jaJP, koKR, zhTW },
    },
    restOptions
  );

  const core = new Core(defaultOptions);
  core.registerPlugin(RPCPlugin);
  core.registerPlugin(RPCClientPlugin);
  core.registerPlugin(ElectronPlugin);
  core.registerPlugin(ElectronRendererPlugin);
  core.registerPlugin(IslandPlugin);
  core.registerPlugin(IslandUIPlugin, { container: ref! });
  core.start();
  return core;
}
