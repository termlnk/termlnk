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

/**
 * Driver 仲裁状态——同一时刻最多 1 个 client 持有键盘控制。
 *
 * 设计依据：cloud-sync-architecture.md §5.7.3 自由竞争协议 + 软锁 UI。
 *
 * 协议层：所有 writer 客户端都可发 stdin，按到达顺序写入 PTY（不丢字节）。
 * UI 层：只有 driverId 标记的 client 默认发送，其他 writer 默认拦截显示"按 X 抢键盘"。
 */
export interface IDriverState {
  readonly sessionId: string;
  readonly driverId: string | null;
  /** 最近一次 driver 心跳——超时 SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS 自动清空 */
  readonly lastHeartbeatAt: number;
  /** owner 是否锁定 driver（true = 不允许抢占，只能 owner 手动让出） */
  readonly locked: boolean;
}

/**
 * Driver 抢占请求 / 让出 / 强制锁定——control channel JSON payload。
 */
export type IDriverHandover =
  | {
    readonly type: 'driver_request';
    readonly sessionId: string;
    readonly fromClientId: string;
  }
  | {
    readonly type: 'driver_handover';
    readonly sessionId: string;
    readonly fromClientId: string | null;
    readonly toClientId: string;
  }
  | {
    readonly type: 'driver_release';
    readonly sessionId: string;
    readonly fromClientId: string;
  };
