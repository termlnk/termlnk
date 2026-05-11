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

export { SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '../common/constants';

export interface ISharedTerminalPluginConfig {
  /**
   * Relay 服务 base URL（含协议与版本前缀，如 `wss://relay.termlnk.cloud/v1`）。
   * 配置后才会启动 daemon，否则 ISharedTerminalService 处于 inactive。
   * 留空 = 共享终端功能禁用（与同步层 cloudBaseUrl 同语义）。
   */
  relayBaseUrl?: string;

  /**
   * HTTPS root for owner-side collaboration management endpoints (P5.5.2:
   * `/v1/collab/invite/{create,revoke,list}`). When configured PairingService
   * mirrors invite lifecycle to the server so distant devices (or the same
   * machine after re-install) can reconcile. Leave undefined to keep all
   * invite state local — relay still works because invites are signed offline.
   */
  cloudBaseUrl?: string;

  /**
   * 是否在用户登录后自动启动 daemon——架构 §5.x"应用启动→ daemon ready"路径。
   * false 时 daemon 仅在用户主动点"添加设备"或"开始协作"时启动。
   */
  autoStartDaemon?: boolean;

  /**
   * 默认录制策略——auditor 加入时会强制开启，owner 可在 UI 覆盖。
   * 设计依据：cloud-sync-architecture.md §5.7.6。
   */
  defaultRecording?: 'off' | 'on';

  /** 仅供测试/集成场景的 DI 覆盖出口；生产部署不应配置。 */
  override?: DependencyOverride;
}

export const defaultPluginConfig: ISharedTerminalPluginConfig = {
  autoStartDaemon: true,
  defaultRecording: 'off',
};
