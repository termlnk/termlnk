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

import type { Observable } from 'rxjs';
import type { IQrPayload } from '../models/pairing';
import type { ClientConnectionState, DaemonState } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/**
 * Shared-terminal 高层入口——上层（UI / desktop bootstrap）通过它启停 daemon
 * 与 client 模式，不直接接触底层 transport / pairing / multiplexer。
 *
 * 实现位置：@termlnk/shared-terminal-core (P5.2/3)
 *
 * **职责**：
 * - 编排 daemon 启动序列（生成 / 加载 keypair → connect transport → 注册 PTY 源）
 * - 编排 client attach 序列（解析 QR → derive sharedKey → connect transport → snapshot）
 * - 暴露面板 UI 需要的总状态（daemonState$ / clientState$ / lastError$）
 *
 * **不做的事**：
 * - 不直接编解码帧（IFrameCodecService）
 * - 不维护参与者列表（IPtyMultiplexerService）
 * - 不生成 QR / 邀请（IPairingService）
 *
 * 这样保持单一职责；上层只跟一个服务说话，但内部分层清晰。
 */
export interface ISharedTerminalService {
  /** Daemon 模式状态 */
  readonly daemonState$: Observable<DaemonState>;

  /** Client 模式状态——同进程允许同时为 daemon + client（同 PC 上配对自己） */
  readonly clientState$: Observable<ClientConnectionState>;

  /** 最后一次错误（startDaemon / connectAsClient 等失败时填充） */
  readonly lastError$: Observable<ISharedTerminalError | null>;

  /**
   * 启动 daemon 模式——加载长期 keypair（OS keychain）、连 relay、准备接受 client。
   * 已启动时 idempotent；幂等 resolve。
   */
  startDaemon(): Promise<void>;

  /**
   * 关闭 daemon——断开所有 attached client、断 relay。
   */
  stopDaemon(): Promise<void>;

  /**
   * Client 模式接入：解析 QR payload → ECDH 派生 sharedKey → 通过 IPairingService
   * 上送 pair_hello → relay 路由给 daemon → 接收 pair_ack 后转入 connected。
   */
  connectAsClient(qr: IQrPayload): Promise<void>;

  /**
   * Client 模式断开。
   */
  disconnectClient(): Promise<void>;
}

export interface ISharedTerminalError {
  readonly code: SharedTerminalErrorCode;
  readonly message: string;
  /** 原始 cause 的 string——避免 IPC 序列化 Error 对象失败 */
  readonly cause?: string;
}

export type SharedTerminalErrorCode =
  | 'keypair_unavailable'
  | 'relay_unreachable'
  | 'qr_invalid'
  | 'qr_expired'
  | 'pair_rejected'
  | 'rate_limited'
  | 'crypto_failure'
  | 'unknown';

export const ISharedTerminalService = createIdentifier<ISharedTerminalService>(
  'shared-terminal.service'
);
