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
import { AuthPlugin } from '@termlnk/auth';
import { DependentOn, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { AuthUIController } from './controllers/auth-ui.controller';

export const AUTH_UI_PLUGIN_NAME = 'AUTH_UI_PLUGIN';

export interface IAuthUIPluginConfig {
  override?: DependencyOverride;
}

/**
 * Auth UI 插件——视图组件 + 命令注册中心。
 *
 * Views（LoginForm / RegisterForm / AccountPanel / AuthGate）作为命名导出供调用方按需 mount。
 * Commands（auth.command.*）由 AuthUIController 在 onReady 阶段注册到 ICommandService，
 * 给扩展 / 快捷键 / 脚本使用——架构 §7.3 给出的 ID 契约的兑现方。
 *
 * 选择不挂到 BuiltInUIPart 的原因：
 * - IAuthClientService 主进程实现要等 Phase 3 HTTP 层；强行挂全局 UI 会让
 *   "未配置云"用户立刻看到禁用按钮，体验不友好
 * - 集成路径（设置 tab / 命令对话框）由 settings-ui 或后续 controller 决定，
 *   保持本包的中性视图角色
 */
@DependentOn(AuthPlugin)
export class AuthUIPlugin extends Plugin {
  static override pluginName = AUTH_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthUIPluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [AuthUIController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [AuthUIController],
    ]);
  }
}
