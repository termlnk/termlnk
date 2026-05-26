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

import { SHARED_TERMINAL_RING_BUFFER_BYTES } from '@termlnk/shared-terminal';
import { HeadlessSession } from '../utils/headless-session';
import { RingBuffer } from '../utils/ring-buffer';

/**
 * Per-session scrollback bundle: raw byte ring buffer + xterm-headless semantic
 * state. Extracted from PtyMultiplexer so the fanout core only orchestrates
 * fanout — snapshot composition lives here in a single-responsibility unit.
 *
 * Lifecycle: owned 1:1 with a registered PTY session; created on register,
 * disposed when the session is unregistered.
 */
export class SessionScrollback {
  private readonly _ringBuffer = new RingBuffer(SHARED_TERMINAL_RING_BUFFER_BYTES);
  private readonly _headless: HeadlessSession;

  constructor(cols: number, rows: number) {
    this._headless = new HeadlessSession({ cols, rows });
  }

  get cols(): number {
    return this._headless.cols;
  }

  get rows(): number {
    return this._headless.rows;
  }

  /** Append a new chunk of PTY output to both the raw ring and the headless terminal. */
  write(chunk: Uint8Array): void {
    this._ringBuffer.write(chunk);
    this._headless.write(chunk);
  }

  resize(cols: number, rows: number): void {
    this._headless.resize(cols, rows);
  }

  /** Snapshot the semantic terminal state as an ANSI replay string. */
  async serialize(scrollback?: number): Promise<string> {
    return this._headless.serialize(scrollback);
  }

  dispose(): void {
    this._headless.dispose();
    this._ringBuffer.clear();
  }
}
