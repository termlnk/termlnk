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
import { powerMonitor } from 'electron';

/**
 * Electron 实现 —— 把 IIdleProbe 接到 `powerMonitor.getSystemIdleTime()`。
 *
 * `getSystemIdleTime` 是 Electron 提供的跨平台 API，返回**系统层面**最后一次输入
 * （鼠标 / 键盘 / 触屏）距今的秒数。比"应用层焦点检测"更准确——用户切窗写文档
 * 时不会被误判为 idle。
 *
 * macOS / Windows / Linux 均支持；调用极轻（系统级 syscall）。
 */
export class ElectronIdleProbe implements IIdleProbe {
  getIdleSeconds(): number {
    return powerMonitor.getSystemIdleTime();
  }
}
