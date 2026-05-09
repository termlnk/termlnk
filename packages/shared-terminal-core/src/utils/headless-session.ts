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

import type { ITerminalAddon } from '@xterm/headless';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/headless';

/**
 * 单 session 的 xterm-headless 包装——维护权威终端 state 并按需 serialize。
 *
 * 设计依据：cloud-sync-architecture.md §5.3。
 *
 * **职责**：
 * - 接收 PTY 输出字节，由 xterm.js parser 解析为光标 / SGR / scrollback 等语义状态
 * - serialize() 输出可在客户端 xterm.js `Terminal.write()` 直接重放的 ANSI 字节串
 * - resize() 在 driver 改变窗口尺寸时同步给 headless terminal 内部 buffer
 *
 * **与 RingBuffer 的分工**：
 * - HeadlessSession：语义级 state（光标位置 / 颜色 / alt-buffer / scrollback line 数）
 * - RingBuffer：raw byte 流（保留 SGR 边界完整性，便于重放最近 N 字节）
 *
 * **不做的事**：
 * - 不做并发同步（调用方在主进程单线程使用）
 * - 不持有任何 attached client 状态——那是 PtyMultiplexer 的职责
 */
export class HeadlessSession {
  private readonly _terminal: Terminal;
  private readonly _serialize: SerializeAddon;

  constructor(opts: { cols: number; rows: number; scrollback?: number }) {
    this._terminal = new Terminal({
      cols: opts.cols,
      rows: opts.rows,
      scrollback: opts.scrollback ?? 1000,
      allowProposedApi: true,
    });
    this._serialize = new SerializeAddon();
    // SerializeAddon 的 ITerminalAddon 类型来自 @xterm/xterm；headless 的同名接口结构相同
    // 但 TS 视为不同类型，运行时完全兼容。Cast 是 xterm.js 生态的标准做法。
    this._terminal.loadAddon(this._serialize as unknown as ITerminalAddon);
  }

  get cols(): number {
    return this._terminal.cols;
  }

  get rows(): number {
    return this._terminal.rows;
  }

  write(chunk: Uint8Array): void {
    this._terminal.write(chunk);
  }

  resize(cols: number, rows: number): void {
    this._terminal.resize(cols, rows);
  }

  /**
   * 输出当前 state 的 ANSI 重放序列。
   *
   * **关键**：xterm.js 的 write 是异步解析（事件循环 chunked），调用 serialize 前
   * 必须等所有 pending write 处理完，否则得到的是中间态。这里通过 zero-length write
   * 注入一个 flush callback 串行化等待。
   */
  async serialize(scrollback?: number): Promise<string> {
    await new Promise<void>((resolve) => {
      this._terminal.write('', () => resolve());
    });
    return this._serialize.serialize({ scrollback });
  }

  dispose(): void {
    this._serialize.dispose();
    this._terminal.dispose();
  }
}
