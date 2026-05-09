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
import type { IFrame } from '../models/frame';
import type { ISharedKey } from '../models/keypair';
import { createIdentifier } from '@termlnk/core';

/**
 * Relay 传输层抽象——daemon ↔ relay 与 client ↔ relay 共用此契约。
 *
 * 实现层有两个：
 * 1. **CloudflareRelayTransportService**（CF Workers + Durable Object）—— SaaS 主路径
 * 2. **NodeRelayTransportService**（uWebSockets.js / undici WS）—— self-host fallback
 *
 * 两个实现共享同一帧格式（§5.2 BinaryMuxFrame）和同一控制语义（pair_hello / driver_handover
 * / rekey 等），只在底层 connection 实现上不同。
 *
 * 设计依据：cloud-sync-architecture.md §6.2 + §5.7.7（relay 控制面新增 RPC）。
 */
export enum TransportState {
  Idle = 'idle',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Disconnected = 'disconnected',
  Error = 'error',
}

export interface ITransportConnectOptions {
  /** Relay base URL；与 ISharedTerminalPluginConfig.relayBaseUrl 一致 */
  readonly relayBaseUrl: string;
  /** sessionId（QR 路径或邀请兑换分配）——用于 relay 把 daemon 与 clients 配对 */
  readonly sessionId: string;
  /** Bearer token（来自 auth.config.accessToken；relay 校验账号归属） */
  readonly accountToken: string;
  /** daemon 模式 = 'daemon'；客户端 attach 模式 = 'client' */
  readonly mode: 'daemon' | 'client';
}

export interface ITransportSendOptions {
  /**
   * 接收方 ID。
   *
   * - daemon 发到 client：传具体 connectionId / 'broadcast'（全员广播）
   * - client 发到 daemon：传 'daemon'
   * - control 帧发到 relay 自身：传 'relay'（如 inviteClaim 转发）
   */
  readonly target: string;
}

/**
 * 入站帧——transport 收到后发到 frames$ Observable，调用方（PtyMultiplexer / Pairing）
 * 按 channel 分发。
 */
export interface IInboundFrame {
  /** 发送方 connectionId（daemon 视角）/ 'daemon'（client 视角） */
  readonly source: string;
  readonly frame: IFrame;
}

export interface ISharedTerminalTransportService {
  readonly state$: Observable<TransportState>;
  readonly frames$: Observable<IInboundFrame>;

  /**
   * 建立连接——内部用 IFrameCodecService 加密发送。
   *
   * 仅 connect 时需要 sharedKey；connect 成功后 secretBox 快路径加密。
   * sharedKey 由 ISharedTerminalCryptoService.deriveSharedKey 派生（QR 路径）
   * 或来自邀请兑换流程（协作路径）。
   */
  connect(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void>;

  disconnect(): Promise<void>;

  /**
   * 发送帧。connect 之前调用抛错（caller 应订阅 state$）。
   * 帧加密在 transport 内部完成；调用方传明文 IFrame。
   */
  send(frame: IFrame, options: ITransportSendOptions): void;

  /**
   * 协作 sessionKey rekey ——所有参与者本地 sharedKey 不变，
   * 但实际帧加密用的对称密钥换成新 sessionKey；transport 内部
   * 在 control channel 发 'rekey' 帧广播。
   *
   * 设计依据：cloud-sync-architecture.md §5.7.5 撤销 / re-key。
   * 仅 daemon 模式可调；client 模式调用抛错。
   */
  rekey(newSessionKey: Uint8Array): Promise<void>;

  /**
   * Daemon 控制端点——立即踢出某 connection（撤销时用）。
   * 仅 daemon 模式可调。
   */
  revokeConnection(connectionId: string): Promise<void>;
}

export const ISharedTerminalTransportService = createIdentifier<ISharedTerminalTransportService>(
  'shared-terminal.transport-service'
);
