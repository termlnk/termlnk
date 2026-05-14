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
 * Byte-level ring buffer — `PtyMultiplexer` uses it to retain raw scrollback.
 *
 * See cloud-sync-architecture.md §5.3 / legacy spec D9 (2 MiB ring buffer).
 *
 * Responsibilities:
 * - Accept PTY output bytes in O(n) writes; old bytes are overwritten once
 *   `capacity` is exceeded.
 * - `snapshot()` returns all currently-retained bytes in chronological order
 *   (oldest → newest).
 * - Complements xterm-headless serialize: serialize emits "semantic state"
 *   (cursor, SGR); the ring buffer emits the raw byte stream. On attach, a
 *   client can restore the visual state from serialize and replay the most
 *   recent N KB of output from raw bytes.
 *
 * Out of scope:
 * - Line-aware truncation — the buffer counts in bytes.
 * - Concurrency. Used single-threaded in the main process.
 */
export class RingBuffer {
  private readonly _buffer: Uint8Array;
  /** Next write position (ring index). */
  private _writePos = 0;
  /** Bytes currently retained (≤ `capacity`). */
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

    // Fast path: a single write exceeds the capacity — keep only the tail.
    if (data.length >= this.capacity) {
      const tail = data.subarray(data.length - this.capacity);
      this._buffer.set(tail, 0);
      this._writePos = 0;
      this._length = this.capacity;
      return;
    }

    const headroom = this.capacity - this._writePos;
    if (data.length <= headroom) {
      // No wrap needed.
      this._buffer.set(data, this._writePos);
      this._writePos = (this._writePos + data.length) % this.capacity;
    } else {
      // Wrap: fill to the buffer's tail first, then continue from 0.
      this._buffer.set(data.subarray(0, headroom), this._writePos);
      this._buffer.set(data.subarray(headroom), 0);
      this._writePos = data.length - headroom;
    }

    this._length = Math.min(this._length + data.length, this.capacity);
  }

  /**
   * Return all retained bytes (oldest → newest). The result is a freshly
   * allocated copy; callers may hold on to it safely.
   */
  snapshot(): Uint8Array {
    if (this._length === 0) {
      return new Uint8Array(0);
    }
    if (this._length < this.capacity) {
      // Pre-wrap: the live region is [0, _writePos).
      return this._buffer.slice(0, this._length);
    }
    // Post-wrap: oldest sits at _writePos, newest at _writePos - 1.
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
