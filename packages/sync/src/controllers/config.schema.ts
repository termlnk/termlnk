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
   * 是否在登录后自动启用同步。
   * 默认 true——架构 §4.6"应用启动→立即 pull 一次"的预期行为，登录后立即 enable。
   * 设 false 时只在用户手动通过 SyncStatusPanel 的开关启用后才同步；本字段
   * 仅控制"登录瞬间"的自动行为，不会反复推翻用户后续的手动选择。
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

  /**
   * 内部状态——本设备最近一次发出的 client_mut_id（per-device monotonic）。
   *
   * 由 SyncOutboxService 通过 ConfigRepository.setField 持久化；启动时读取以避免
   * outbox 被 ack 清空后重新从 0 开始重复利用旧 ID。**禁止用户手动修改**——
   * 改它会让服务端去重失效甚至产生 mutation 覆写。
   */
  lastClientMutId?: number;
}

export const defaultPluginConfig: ISyncPluginConfig = {
  autoEnableOnLogin: true,
  excludedResources: [],
};
