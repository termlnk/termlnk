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
 * 共享终端角色——4 级权限模型。
 *
 * 设计依据：cloud-sync-architecture.md §5.7.2。
 *
 * | 角色 | 权限 | 备注 |
 * |------|------|------|
 * | Owner | PTY 持有者；唯一可邀请、撤销、kick、降级；永远可写 | 同账号设备登录默认 owner |
 * | CoPilot | 受邀写者；与 owner/其他 co-pilot 通过软锁轮转输入；可让出键盘 | 跨账号协作的常见角色；同账号其他设备也用 |
 * | Observer | 只读；订阅 PTY 输出但不发 stdin；可禁用敏感字段回显 | 围观、答疑、教学 |
 * | Auditor | 与 observer 同权限；**加入即强制录制**且 UI 显著标识 | 合规预留 |
 *
 * Phase 5 单账号场景：daemon = Owner，其他登录设备 = CoPilot。
 * Phase 5.5 跨账号协作：所有四个角色都被使用，邀请时 capability 携带角色字段。
 */
export enum SharedTerminalRole {
  Owner = 'owner',
  CoPilot = 'co-pilot',
  Observer = 'observer',
  Auditor = 'auditor',
}

/**
 * 角色 → 是否可写（发 stdin）。Owner / CoPilot 是 writer；Observer / Auditor 只读。
 * 仲裁是 UI 软锁——driver 标记决定实际是否发送（参见 IDriverState）。
 */
export function isWriterRole(role: SharedTerminalRole): boolean {
  return role === SharedTerminalRole.Owner || role === SharedTerminalRole.CoPilot;
}

/**
 * 角色 → 是否强制开启录制。Auditor 加入即强制；其他角色由 owner 在 UI 选择。
 */
export function requiresMandatoryRecording(role: SharedTerminalRole): boolean {
  return role === SharedTerminalRole.Auditor;
}
