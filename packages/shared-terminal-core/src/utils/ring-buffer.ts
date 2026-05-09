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
 * 字节级环形缓冲——PtyMultiplexer 用来缓 raw scrollback。
 *
 * 设计依据：cloud-sync-architecture.md §5.3 / 旧规范 D9（2 MiB ring buffer）。
 *
 * **职责**：
 * - 接收 PTY 输出字节，O(n) 写入；超出 capacity 的旧字节被新字节覆盖
 * - snapshot() 按时间序（旧→新）输出当前持有的全部字节
 * - 与 xterm-headless 的 serialize 互补：serialize 输出"语义状态"（光标/SGR），
 *   ring buffer 提供"原始字节流"——客户端 attach 时既可用 serialize 复原界面，
 *   也可用 raw bytes 重放最近 N KB 输出
 *
 * **不做的事**：
 * - 不做 line-aware 截断（按字节计）
 * - 不做并发同步（调用方在主进程单线程使用）
 */
export class RingBuffer {
  private readonly _buffer: Uint8Array;
  /** 下一个写入位置（环形 index） */
  private _writePos = 0;
  /** 当前已写入的有效字节数（≤ capacity） */
  private _length = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`[RingBuffer] capacity must be a positive integer, got ${capacity}`);
    }
    this._buffer = new Uint8Array(capacity);
  }

  get size(): number {
    return this._length;
  }

  get full(): boolean {
    return this._length >= this.capacity;
  }

  write(data: Uint8Array): void {
    if (data.length === 0) {
      return;
    }

    // Optimisation: 单次写入超过 capacity，只保留尾部 capacity 字节
    if (data.length >= this.capacity) {
      const tail = data.subarray(data.length - this.capacity);
      this._buffer.set(tail, 0);
      this._writePos = 0;
      this._length = this.capacity;
      return;
    }

    const headroom = this.capacity - this._writePos;
    if (data.length <= headroom) {
      // 不需要 wrap
      this._buffer.set(data, this._writePos);
      this._writePos = (this._writePos + data.length) % this.capacity;
    } else {
      // wrap：先填到 buffer 尾，再从 0 继续
      this._buffer.set(data.subarray(0, headroom), this._writePos);
      this._buffer.set(data.subarray(headroom), 0);
      this._writePos = data.length - headroom;
    }

    this._length = Math.min(this._length + data.length, this.capacity);
  }

  /**
   * 输出当前 ring 中所有字节（旧→新顺序）；返回**新分配**的副本，调用方可放心持有。
   */
  snapshot(): Uint8Array {
    if (this._length === 0) {
      return new Uint8Array(0);
    }
    if (this._length < this.capacity) {
      // 还没有 wrap：[0, _writePos) 是有效区
      return this._buffer.slice(0, this._length);
    }
    // 已经 wrap：oldest 在 _writePos，newest 在 _writePos-1
    const out = new Uint8Array(this._length);
    const tail = this.capacity - this._writePos;
    out.set(this._buffer.subarray(this._writePos), 0);
    out.set(this._buffer.subarray(0, this._writePos), tail);
    return out;
  }

  clear(): void {
    this._writePos = 0;
    this._length = 0;
  }
}
