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
 * 一台已登录设备的元信息——用于"账号 → 设备列表"UI。
 *
 * `id` 是后端 refresh-token 的 jti（公开它无安全风险，本身不是 secret）；同一物理
 * 设备每次 refresh 后 jti 会变化，但 deviceName 和 createdAt 跨 rotation 保留。
 */
export interface IDevice {
  /** 后端 refresh-token jti；UI 用作 React key + 撤销时的目标 ID */
  readonly id: string;
  /** 客户端登录时上报的设备标签（默认 os.hostname()）；可能为 null（旧客户端登录） */
  readonly deviceName: string | null;
  /** User-Agent 头（粗粒度指纹）；可能为 null */
  readonly userAgent: string | null;
  /** 该设备首次登录时间（ISO） */
  readonly createdAt: string;
  /** 最近一次 refresh 时间（ISO）——UI 排序依据 */
  readonly lastSeenAt: string;
  /** refresh-token 过期时间（ISO） */
  readonly expiresAt: string;
  /** 当前发起请求的设备本身——UI 高亮"This device" */
  readonly isCurrent: boolean;
}
