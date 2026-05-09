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
import type { ICollabInvite, IInviteClaimResult, IInviteCreateOptions } from '../models/invite';
import type { IPairedDevice, IQrPayload } from '../models/pairing';
import { createIdentifier } from '@termlnk/core';

/**
 * 配对服务（owner 端契约）——同账号 QR 配对 + 跨账号协作邀请。
 *
 * 设计依据：cloud-sync-architecture.md §5.2（QR 路径）+ §5.7.4（邀请路径）。
 *
 * 实现位置：@termlnk/shared-terminal-core (P5.2/P5.3 阶段)。
 *
 * **职责**：
 * - 生成 / 撤销 / 列出 当前账号下的 paired 设备
 * - 生成 / 撤销 / 列出 跨账号协作邀请
 * - 不参与 PTY 帧传输——那是 IPtyMultiplexerService 的职责
 *
 * 安全语义：
 * - daemon 长期 keypair 永不出 OS keychain
 * - QR payload 含 daemon 公钥（公开它无安全风险）+ 短期 accountToken
 * - 邀请 ephPriv 仅写入 fragment，relay 永不见
 */
export interface IPairingService {
  /** daemon 当前已配对的设备列表——UI 渲染"我的设备" */
  readonly pairedDevices$: Observable<readonly IPairedDevice[]>;

  /** 当前 outstanding 协作邀请列表——UI 渲染"已生成的链接" */
  readonly outstandingInvites$: Observable<readonly ICollabInvite[]>;

  /**
   * 启动同账号 QR 配对——daemon 生成一次性 sessionId，返回 QR payload + sessionId。
   * 调用方（UI）把 payload JSON 编码后渲染为 QR 码。
   *
   * sessionId 在 QR 显示后 5 分钟内有效（配对完成或过期前）；同时只允许 1 个 active QR。
   */
  startQrPairing(): Promise<{ qrPayload: IQrPayload; sessionId: string }>;

  /**
   * 取消当前 active QR 配对——用户关闭 dialog / 超时自动调用。
   */
  cancelQrPairing(sessionId: string): Promise<void>;

  /**
   * 撤销已配对设备——后续该设备 attach 时 daemon 拒绝。
   * 如果设备当前在线，强制断开。
   */
  revokeDevice(deviceId: string): Promise<void>;

  /**
   * 创建跨账号协作邀请——返回 invite + URL。owner UI 把 URL 复制给受邀者。
   *
   * 实现细节（参见 §5.7.5）：
   * - daemon 生成一对 ephemeral X25519 keypair
   * - relay 登记 (inviteId, ephPub, capabilityHash, exp, used)
   * - URL 形如 `https://invite.termlnk.io/s/<inviteId>#<base64url(ephPriv || capability)>`
   */
  createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }>;

  /**
   * 撤销协作邀请——relay 标记 invalid；即使 fragment 在外面流传也无法兑换。
   */
  revokeInvite(inviteId: string): Promise<void>;

  /**
   * 邀请兑换结果观察——relay 通过 control channel 回送，daemon 解析后发到此 Observable。
   * UI 展示"张三已加入"通知；可与 audit log 同步。
   */
  readonly inviteClaims$: Observable<IInviteClaimResult>;
}

export const IPairingService = createIdentifier<IPairingService>('shared-terminal.pairing-service');
