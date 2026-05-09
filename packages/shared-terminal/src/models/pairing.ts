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
 * QR 配对 payload——daemon 启动配对时显示的 QR 码内容。
 *
 * 设计依据：cloud-sync-architecture.md §5.2。
 *
 * **同账号配对路径**（Phase 5）：
 * - daemon 长期 keypair 已落 OS keychain
 * - daemon 生成一次性 sessionId
 * - QR 含 daemonPubkey + relay endpoint + accountToken
 * - 客户端扫码后用 daemonPubkey 派生 sharedKey 接入 relay
 *
 * **JSON 序列化**：QR 二维码体积有限，字段名都用短缩写（v/relay/sid/dpk/at）。
 */
export interface IQrPayload {
  /** schema 版本——SHARED_TERMINAL_QR_VERSION */
  readonly v: number;
  /** Relay base URL（如 wss://relay.termlnk.cloud/v1） */
  readonly relay: string;
  /** 一次性 sessionId（base64url 32 bytes） */
  readonly sid: string;
  /** daemon 长期公钥（base64url 32 bytes） */
  readonly dpk: string;
  /** 短期 JWT，证明客户端属于同一账号；relay 校验后才放行 */
  readonly at: string;
}

/**
 * 已成功配对设备——daemon 端持久化记录。
 *
 * - 同账号场景：每个登录设备都会出现一条记录
 * - 跨账号协作场景：每个 active 邀请兑换后也产生一条记录（区分 origin=qr|invite）
 */
export interface IPairedDevice {
  /** 设备 ID——daemon 分配的随机 ID（与后端 refresh-token jti 不同维度） */
  readonly id: string;
  /** 显示名（客户端登录时上报；可能 undefined） */
  readonly displayName?: string;
  /** 客户端长期公钥（base64url 32 bytes） */
  readonly clientPubkey: string;
  /** 客户端 user-agent / platform 提示（粗粒度） */
  readonly userAgentHint?: string;
  /** 配对来源 */
  readonly origin: 'qr' | 'invite';
  /** 配对完成时间（ms epoch） */
  readonly pairedAt: number;
  /** 最近一次活跃时间（ms epoch） */
  readonly lastSeenAt: number;
  /** 是否当前在线 */
  readonly online: boolean;
}

/**
 * Pair_hello 控制帧 payload——客户端扫码后发到 daemon 的第一条消息。
 *
 * 这是 control channel 上 type='pair_hello' 的 JSON schema。
 * daemon 验证 accountToken 后回 pair_ack（含 paired device id）或 pair_reject（带 reason）。
 */
export interface IPairHelloPayload {
  readonly type: 'pair_hello';
  readonly clientPubkey: string;
  readonly accountToken: string;
  readonly displayName?: string;
  readonly userAgentHint?: string;
}

export interface IPairAckPayload {
  readonly type: 'pair_ack';
  readonly deviceId: string;
  /** daemon 派发给该客户端的 sessionKey（用 NaCl box 加密——sharedKey 已在 ECDH 派生）*/
  readonly sessionKeyEnvelope: string; // base64url
}

export interface IPairRejectPayload {
  readonly type: 'pair_reject';
  readonly reason: 'invalid_token' | 'account_mismatch' | 'expired' | 'rate_limited' | 'unknown';
  readonly message?: string;
}
