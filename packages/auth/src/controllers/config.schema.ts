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
   * 云服务 base URL（如 `https://cloud.termlnk.io/v1` 或 self-hosted 地址）。
   * 离线模式可不配置——auth 服务在无 cloudUrl 时仍能启动，仅是所有云端动作返回错误。
   */
  cloudUrl?: string;

  /**
   * 自动 lock 的空闲时长（分钟）。0 表示永不自动 lock。
   * 用户主动 logout 永远 lock；本字段仅控制空闲超时。
   */
  autoLockIdleMinutes?: number;
}

export const defaultPluginConfig: IAuthPluginConfig = {
  autoLockIdleMinutes: 0,
};
