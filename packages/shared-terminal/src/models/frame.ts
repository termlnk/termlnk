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
 * 多通道帧的逻辑通道。
 *
 * 设计依据：cloud-sync-architecture.md §5.2 二进制多路复用 BinaryMuxFrame。
 *
 * - **Control**：握手 / pairing 完成通知 / driver 切换 / kick / rekey / 心跳
 * - **PtyData**：双向 PTY 字节流（owner→client 是 PTY 输出；client→owner 是 stdin）
 * - **SessionEvent**：参与者加入/离开、status 变更、recording 开始/结束、resize 等结构化事件
 *
 * 三通道独立 seq 计数——保证同通道有序，跨通道不阻塞。
 */
export enum FrameChannel {
  Control = 0,
  PtyData = 1,
  SessionEvent = 2,
}

/**
 * Frame flag 位掩码——预留扩展位避免协议演进时 break。
 *
 * | bit | 名称 | 含义 |
 * |-----|------|------|
 * | 0 | AckRequired | 接收端需回 ack 帧（control 帧用）|
 * | 1 | Compressed | payload 是 zstd 压缩字节（PTY 输出降弱网） |
 * | 2 | EndOfStream | 配合分片：连续帧序列的最后一片 |
 * | 3..7 | Reserved | 必须为 0；接收端 MUST 忽略未知位（向后兼容铁律） |
 */
export enum FrameFlag {
  None = 0,
  AckRequired = 1,
  Compressed = 2,
  EndOfStream = 4,
}

/**
 * 单个逻辑帧——加密前的明文表示。
 *
 * 加密路径：encode → NaCl box (sharedKey + nonce) → wire bytes。
 * 解密路径反之。详见 IFrameCodecService。
 */
export interface IFrame {
  /** 通道 ID */
  readonly channel: FrameChannel;
  /** 标志位掩码（FrameFlag 联合） */
  readonly flags: number;
  /** 该通道内单调递增的 32-bit 序号（uint32） */
  readonly seq: number;
  /** 帧载荷——按通道语义解释（control/event JSON UTF-8 编码；ptyData 原始字节）*/
  readonly payload: Uint8Array;
}

/**
 * Control 通道事件类型——payload 是 UTF-8 JSON。
 *
 * 各事件的 schema 定义在 IControlMessage 子类型中；接收端按 type 分发。
 */
export const CONTROL_MESSAGE_TYPES = [
  'pair_hello',
  'pair_ack',
  'pair_reject',
  'driver_request',
  'driver_handover',
  'driver_release',
  'rekey',
  'kick',
  'heartbeat',
  'resize',
  'error',
] as const;
export type ControlMessageType = (typeof CONTROL_MESSAGE_TYPES)[number];

/**
 * Session 通道事件类型——payload 是 UTF-8 JSON，UI 用于参与者列表更新等。
 */
export const SESSION_EVENT_TYPES = [
  'participant_joined',
  'participant_left',
  'role_changed',
  'recording_started',
  'recording_stopped',
  'snapshot',
] as const;
export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];
