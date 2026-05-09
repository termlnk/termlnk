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

import type { IIdleProbe } from '@termlnk/auth';

/**
 * 占位 IdleProbe——永远返回 0（"从不空闲"）。
 *
 * 用途：非 Electron 集成（纯 Node 测试 / CLI 工具 / 单元测试 testbed）下提供
 * 一个不需要 OS API 的实现；IdleLockController 注入它后，autoLockIdleMinutes
 * 永远不会触发，等于实际禁用空闲自动锁——这在没有 OS 输入信号的环境里是
 * 唯一安全的默认值。
 */
export class NoopIdleProbe implements IIdleProbe {
  getIdleSeconds(): number {
    return 0;
  }
}
