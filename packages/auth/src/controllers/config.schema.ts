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

import type { DependencyOverride } from '@termlnk/core';

export { AUTH_PLUGIN_CONFIG_KEY } from '../common/constants';

export interface IAuthPluginConfig {
  override?: DependencyOverride;

  /**
   * 自动 lock 的空闲时长（分钟）。0 表示永不自动 lock。
   * 用户主动 logout 永远 lock；本字段仅控制空闲超时。
   * 由 IdleLockController（@termlnk/auth-core）轮询并触发 IMasterKeyService.lock()。
   */
  autoLockIdleMinutes?: number;
}

// 注：云服务 base URL 不在本契约层 config——它是 AuthCorePlugin 的构造参数
// （IAuthCorePluginConfig.cloudBaseUrl），属于"插件实例化时的启动决策"。
// 重复声明会产生 contract / impl 两边都看似可配置但实际只有 impl 那边生效的歧义。

export const defaultPluginConfig: IAuthPluginConfig = {
  autoLockIdleMinutes: 0,
};
