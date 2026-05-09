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
import type { IDriverState } from '../models/driver';
import type { IFrame } from '../models/frame';
import type { SharedTerminalRole } from '../models/role';
import type { IParticipant, ISessionSnapshot, ISharedSession } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/**
 * 真实 PTY 源接口——SharedTerminalCore 的 PtyMultiplexerService 通过此接口连接 termlnk
 * 现有的 SSH/PTY 实现，避免反向依赖 @termlnk/rpc-server。
 *
 * 调用方（@termlnk/rpc-server 的 SshSocketService 或 PtySocketService）
 * 通过 register 把每个活跃 PTY 注册进来；multiplexer 负责 fan-out。
 */
export interface IPtySource {
  /** 单调递增 ID，用作 session 主键；与 SSH/PTY 上层 sessionId 1:1 映射 */
  readonly id: string;
  /** 终端列宽 */
  readonly cols: number;
  /** 终端行数 */
  readonly rows: number;
  /** 显示名（host 名 / shell 命令） */
  readonly title: string;
  /** PTY 输出字节流（来自 SSH/PTY） */
  readonly output$: Observable<Uint8Array>;
  /** 写 stdin 到 PTY（来自客户端聚合后的 driver 输入） */
  write(data: Uint8Array): void;
  /** Resize 通知（来自 driver；不接受可抛错） */
  resize(cols: number, rows: number): void;
}

/**
 * PTY 多路复用器——daemon 端把单个 PTY fan-out 给多个 attached 客户端。
 *
 * 设计依据：cloud-sync-architecture.md §5.3 PtyMultiplexer。
 *
 * 实现要点（P5.2 阶段落地）：
 * - 每 session 维护 1 个 xterm-headless 实例（serialize state）
 * - 2 MiB ring buffer 缓 raw scrollback（client attach 时一次性补齐）
 * - Driver 仲裁：协议层接受所有 writer 字节，但 UI 层默认只让 driver 发
 * - 输入聚合：driver 发的 stdin → multiplexer.write → 真实 PTY
 *
 * 实现位置：@termlnk/shared-terminal-core (P5.2)
 */
/**
 * 出站帧——multiplexer 决定要发到 transport 的帧；transport 按 target 路由。
 */
export interface IOutboundFrame {
  readonly sessionId: string;
  /** 'broadcast' = 该 session 所有 attached client；否则是具体 clientId */
  readonly target: string;
  readonly frame: IFrame;
}

export interface IPtyMultiplexerService {
  /** 当前所有 active 共享会话 */
  readonly sessions$: Observable<readonly ISharedSession[]>;

  /**
   * 全局 outbound 流——transport 订阅此流把帧发给具体 client / 广播。
   * Multiplexer 不知道 transport 的存在；解耦在此线分割。
   */
  readonly outbound$: Observable<IOutboundFrame>;

  /** 单 session 的 driver 状态变化流（供 UI 渲染软锁状态） */
  driverState$(sessionId: string): Observable<IDriverState>;

  /** 单 session 当前所有参与者 */
  participants$(sessionId: string): Observable<readonly IParticipant[]>;

  /**
   * 注册一个 PTY 源——通常由 SSH 服务在新 session 创建时调用。
   * 返回 unregister 句柄；调用 unregister 后 multiplexer 停止 fan-out + 通知所有 attached client。
   */
  register(source: IPtySource): IRegisteredPty;

  /** 取活跃 session 的最近一次 snapshot——客户端 attach / 重连时用 */
  snapshot(sessionId: string): Promise<ISessionSnapshot>;

  /** 设置 driver；null = 释放（无人持有键盘） */
  setDriver(sessionId: string, clientId: string | null): void;

  /** owner 锁定 driver——禁止抢占，仅可由 owner 显式让出 */
  lockDriver(sessionId: string, clientId: string): void;

  /** 解锁 driver——允许其他 writer 抢占 */
  unlockDriver(sessionId: string): void;

  /** 强制踢出某客户端（撤销时调用） */
  kick(sessionId: string, clientId: string, reason?: string): void;

  /**
   * Attach 一个逻辑客户端——transport 在 pair_ack / invite_claim 完成后调用。
   * Multiplexer 自动为该客户端发送 snapshot frame（session event）。
   */
  attachClient(sessionId: string, clientId: string, role: SharedTerminalRole, displayName?: string): void;

  /** Detach（client 断开时 transport 调用）——清 driver 标记 / 移除参与者 */
  detachClient(sessionId: string, clientId: string): void;

  /**
   * 处理一个来自客户端的入站帧——transport 收到 pair-ed client 的帧后调用。
   *
   * - PtyData：检查 clientId 是 driver → 写到底层 PTY
   * - Control：driver_request / driver_release / heartbeat / resize 等
   * - SessionEvent：通常 client → owner 不发；若发则忽略（防伪造）
   */
  handleInbound(sessionId: string, clientId: string, frame: IFrame): void;

  /** 客户端心跳——multiplexer 用来判断 driver 是否还活着（5s 超时清空） */
  clientHeartbeat(sessionId: string, clientId: string): void;
}

/**
 * 单个已注册 PTY 的句柄——调用方持有，用于解注册。
 * Multiplexer 内部维护其他状态（driver / clients / ring buffer）。
 */
export interface IRegisteredPty {
  readonly sessionId: string;
  unregister(): void;
}

export const IPtyMultiplexerService = createIdentifier<IPtyMultiplexerService>(
  'shared-terminal.pty-multiplexer-service'
);
