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

import type { IDisposable } from '@termlnk/core';
import { TERMINAL_OUTPUT_ACK_BATCH_BYTES, TERMINAL_OUTPUT_ACK_INTERVAL_MS } from '../models/terminal-output';

export class TerminalOutputAckBuffer implements IDisposable {
  private _pendingSequence: number | null = null;
  private _pendingBytes = 0;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _isDisposed = false;

  constructor(
    private readonly _send: (sequence: number) => void
  ) {}

  acknowledge(sequence: number, byteLength: number): void {
    if (this._isDisposed) {
      return;
    }
    if (this._pendingSequence === null || isSequenceAfter(sequence, this._pendingSequence)) {
      this._pendingSequence = sequence;
    }
    this._pendingBytes += byteLength;
    if (this._pendingBytes >= TERMINAL_OUTPUT_ACK_BATCH_BYTES) {
      this.flush();
      return;
    }
    if (!this._timer) {
      this._timer = setTimeout(() => this.flush(), TERMINAL_OUTPUT_ACK_INTERVAL_MS);
    }
  }

  flush(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this._pendingSequence === null || this._isDisposed) {
      return;
    }

    const sequence = this._pendingSequence;
    this._pendingSequence = null;
    this._pendingBytes = 0;
    this._send(sequence);
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._pendingSequence = null;
    this._pendingBytes = 0;
  }
}

function isSequenceAfter(candidate: number, current: number): boolean {
  const distance = (candidate - current) >>> 0;
  return distance > 0 && distance < 0x80000000;
}
