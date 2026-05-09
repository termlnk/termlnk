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
import { DependentOn, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { SyncPlugin } from '@termlnk/sync';
import { SyncUIController } from './controllers/sync-ui.controller';

export const SYNC_UI_PLUGIN_NAME = 'SYNC_UI_PLUGIN';

export interface ISyncUIPluginConfig {
  override?: DependencyOverride;
}

/**
 * Sync UI 插件——同步状态面板 + 命令注册中心。
 *
 * 组件（SyncStatusPanel / BackupCard）作为命名导出，由 settings-ui 决定挂载位置。
 * 命令（sync.command.*）由 SyncUIController 在 onReady 阶段注册到 ICommandService，
 * 给扩展 / 快捷键 / 脚本使用——架构 §7.3 给出的 ID 契约的兑现方。
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
    const dependencies: Dependency[] = [
      [SyncUIController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [SyncUIController],
    ]);
  }
}
