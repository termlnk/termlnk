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

import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { DependentOn, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { SyncPlugin } from '@termlnk/sync';

export const SYNC_UI_PLUGIN_NAME = 'SYNC_UI_PLUGIN';

export interface ISyncUIPluginConfig {
  override?: DependencyOverride;
}

/**
 * Sync UI 插件——同步状态面板的命名导出占位 plugin。
 *
 * 与 AuthUIPlugin 同样保持轻量：组件（SyncStatusPanel）作为命名导出，
 * 由 settings-ui 或后续 controller 决定挂载位置。这里只承载 config 注册位
 * 让 desktop main bootstrap 能形式化注册。
 */
@DependentOn(SyncPlugin)
export class SyncUIPlugin extends Plugin {
  static override pluginName = SYNC_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: ISyncUIPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
