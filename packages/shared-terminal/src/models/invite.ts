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
 * 跨账号协作邀请的能力声明（capability）。
 *
 * 设计依据：cloud-sync-architecture.md §5.7.5。
 *
 * 用法：owner 生成邀请时，capability 被一并嵌入 inviteSecret（URL fragment），
 * relay 拿到 capability_hash 但拿不到 capability 本身（不能用于解密，仅用于审计/限流）。
 *
 * 关键安全语义：
 * - capability **不是** 解密密钥；它只是 owner 对受邀者权限的承诺
 * - 解密通过 ephemeral X25519 wrap 完成（详见 ICollabInvite.ephPriv）
 * - capability_hash 在 relay 侧登记，确保 capability 与受邀者声明一致
 */
export interface ICapability {
  /** schema 版本——SHARED_TERMINAL_CAPABILITY_VERSION */
  readonly v: number;
  /** 协作 sessionId */
  readonly sid: string;
  /** 受邀者角色 */
  readonly role: SharedTerminalRole;
  /** capability 过期时间（ms epoch） */
  readonly exp: number;
  /** 防重放 nonce（base64url 16 bytes） */
  readonly nonce: string;
}

/**
 * 协作邀请——owner 生成、最终编码到 invite URL fragment 的内容。
 *
 * URL: `https://invite.termlnk.io/s/<inviteId>#<base64url(ephPriv || capability)>`
 *                                              ↑ fragment 浏览器/客户端不上送服务端
 *
 * fragment 是邀请的真正密钥载体；inviteId 只是 relay 侧索引。
 */
export interface ICollabInvite {
  /** 邀请 ID——relay 登记 (inviteId, ephPub, capabilityHash, exp, used)，用于查找/撤销 */
  readonly inviteId: string;
  /** 一次性 ephemeral X25519 私钥（base64url 32 bytes）——只存在于 fragment */
  readonly ephPriv: string;
  /** 对应公钥——relay 登记，受邀者用公钥派生临时通道但不能解 sessionKey */
  readonly ephPub: string;
  /** 能力声明 */
  readonly capability: ICapability;
  /** 是否单次兑换（默认 true）；owner 可勾选可重复使用 */
  readonly singleUse: boolean;
}

/**
 * 邀请兑换 — 受邀者发到 relay 的 payload，封装在 ephPriv 派生的临时通道里。
 *
 * relay 验证 capabilityHash 一致后路由给 daemon。
 */
export interface IInviteClaimPayload {
  readonly inviteId: string;
  /** 受邀者长期公钥（base64url 32 bytes）——daemon 用此 + 自己 secret 派生 sharedKey 给该用户分发 sessionKey */
  readonly userPubkey: string;
  /** capability 明文（重新加密发到 relay；daemon 用 ephPub+? 校验对应 inviteId 一致）*/
  readonly capabilityCipher: string;
  /** 受邀者上报的显示名（UI 给 owner 看） */
  readonly displayName?: string;
}

/**
 * 邀请兑换结果——relay → daemon 通知，daemon → relay 确认。
 */
export interface IInviteClaimResult {
  readonly inviteId: string;
  /** 服务端分配的 connectionId（per-connection 撤销用） */
  readonly connectionId: string;
  /** 邀请仍可用 / 已过期 / 已被消费 / 被撤销 */
  readonly status: 'accepted' | 'expired' | 'consumed' | 'revoked' | 'invalid';
  readonly reason?: string;
}

/**
 * 邀请生成参数——owner UI 提交。
 */
export interface IInviteCreateOptions {
  /** 角色——决定能否写、能否回显敏感字段 */
  readonly role: SharedTerminalRole;
  /** 过期时长（毫秒）—— UI 选 15min/1h/24h/never；never = Number.MAX_SAFE_INTEGER */
  readonly ttlMs: number;
  /** 是否单次兑换 */
  readonly singleUse: boolean;
  /** 友好名称——owner 用来识别"给张三的链接" */
  readonly note?: string;
}
