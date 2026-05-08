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
import type { SyncResourceId } from '../common/constants';

export { SYNC_PLUGIN_CONFIG_KEY } from '../common/constants';

export interface ISyncPluginConfig {
  override?: DependencyOverride;

  /**
   * 是否在登录后自动启用同步。false 时需用户在设置中手动开启。
   */
  autoEnableOnLogin?: boolean;

  /**
   * 排除不同步的资源类型——用户偏好。
   * 注意：chat 类资源由 cloud-sync-architecture.md §10.2 决策永不同步——本字段仅控制可选资源。
   */
  excludedResources?: SyncResourceId[];

  /**
   * 客户端 ID（per-device，用于服务端去重 mutation）。
   * 首次启动时随机生成并持久化到 sync_cursor 表附属。
   */
  clientId?: string;
}

export const defaultPluginConfig: ISyncPluginConfig = {
  autoEnableOnLogin: false,
  excludedResources: [],
};
