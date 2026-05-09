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

import { createIdentifier } from '@termlnk/core';

/**
 * 系统空闲时长探针——返回用户最近一次输入到现在经过的秒数。
 *
 * 抽象出 OS 层"空闲多久"的查询，让 auth-core 的 IdleLockController 可以在
 * 不依赖 Electron 的情况下决定是否自动锁定 master key。
 *
 * 实现位置：
 * - `@termlnk/auth-core`：NoopIdleProbe（永远返回 0，等于 "从不空闲"——
 *   纯 Node 测试或非 Electron 集成场景下使用）
 * - `@termlnk/electron-main`：ElectronIdleProbe（包装 `electron.powerMonitor.getSystemIdleTime()`）
 *
 * 取值语义：
 * - `0`：用户刚刚有输入（鼠标 / 键盘）
 * - `N`：N 秒内没有输入
 *
 * 不抛错——OS API 失败时实现方应回退到 `0`，宁可不锁也不要因为探测失败误锁用户。
 */
export interface IIdleProbe {
  getIdleSeconds(): number;
}

export const IIdleProbe = createIdentifier<IIdleProbe>('auth.idle-probe');
