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

import type { SharedTerminalRole } from './role';

/**
 * Daemon 总状态——区分"未启动 / 已启动等待 relay / 已连接 relay 等待 PTY 注册 / 在线"。
 */
export enum DaemonState {
  Inactive = 'inactive',
  Starting = 'starting',
  AwaitingRelay = 'awaiting_relay',
  Online = 'online',
  Error = 'error',
}

/**
 * Client 端总状态——配对前/中/后。
 */
export enum ClientConnectionState {
  Idle = 'idle',
  Pairing = 'pairing',
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

/**
 * 单个 SSH/PTY 会话被广播为协作会话的状态。
 *
 * - **Idle**：PTY 在跑，但还没人 attach（除 owner 自己）
 * - **Active**：≥1 个 client 在 attach
 * - **Recording**：协议层面正在落 asciicast；不阻塞 Active
 * - **Closed**：PTY 已退出
 */
export enum SharedSessionState {
  Idle = 'idle',
  Active = 'active',
  Recording = 'recording',
  Closed = 'closed',
}

/**
 * 一个被广播出去的 PTY 会话——daemon 端视角。
 */
export interface ISharedSession {
  /** 会话 ID（与 termlnk SSH session ID 一对一） */
  readonly id: string;
  /** 用户起的名字（host 名 / "ssh prod-bastion"） */
  readonly title: string;
  /** 当前状态 */
  readonly state: SharedSessionState;
  /** 终端列宽 */
  readonly cols: number;
  /** 终端行数 */
  readonly rows: number;
  /** 创建时间（ms epoch） */
  readonly createdAt: number;
  /** 当前所有 attached 客户端 ID（含 owner 自己） */
  readonly participantIds: readonly string[];
  /** 当前 driver 客户端 ID（null = 无人持有键盘） */
  readonly driverId: string | null;
  /** 是否正在录制 */
  readonly recording: boolean;
}

/**
 * 客户端 attach 时拿到的会话快照——状态恢复用。
 *
 * snapshot 字段含 xterm-headless serialize 的完整 state（光标 / SGR / scrollback）。
 * 弱网重连时一次性补齐，避免画面撕裂。
 */
export interface ISessionSnapshot {
  readonly sessionId: string;
  readonly title: string;
  readonly cols: number;
  readonly rows: number;
  /** xterm-addon-serialize 输出的 ANSI 字节串（可直接 write 给 client xterm 实例恢复） */
  readonly serialized: string;
  /** 快照生成时刻该会话已观察到的最高 ptyData seq——客户端从 seq+1 开始监听 */
  readonly observedSeq: number;
  readonly state: SharedSessionState;
  readonly driverId: string | null;
}

/**
 * 参与者视角——给 client / UI 用。
 *
 * 与 IPairedDevice 区别：PairedDevice 是"曾经配对过的客户端"，Participant 是
 * "当前 attached 到某 session 的活跃 connection"，是更短暂的运行时实体。
 */
export interface IParticipant {
  readonly connectionId: string;
  readonly displayName: string;
  readonly role: SharedTerminalRole;
  readonly joinedAt: number;
  readonly isCurrent: boolean;
}
