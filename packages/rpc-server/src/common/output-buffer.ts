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

import type { Observable, Subscription } from 'rxjs';

const MAX_BUFFER_SIZE = 256 * 1024; // 256KB per session
const BUFFER_INACTIVITY_TIMEOUT = 60_000; // 60s auto cleanup

interface ISessionOutputBuffer {
  chunks: string[];
  totalLength: number;
  subscription: Subscription;
  inactivityTimer: ReturnType<typeof setTimeout> | null;
}

export class OutputBufferManager {
  private readonly _buffers = new Map<string, ISessionOutputBuffer>();

  ensureBuffering(sessionId: string, data$: Observable<Uint8Array | string>): void {
    const existing = this._buffers.get(sessionId);
    if (existing) {
      this._resetInactivityTimer(sessionId);
      return;
    }

    const decoder = new TextDecoder('utf-8');
    const buffer: ISessionOutputBuffer = {
      chunks: [],
      totalLength: 0,
      subscription: null!,
      inactivityTimer: null,
    };

    buffer.subscription = data$.subscribe((data) => {
      const text = typeof data === 'string' ? data : decoder.decode(data, { stream: true });
      buffer.chunks.push(text);
      buffer.totalLength += text.length;

      // FIFO eviction when exceeding max size
      while (buffer.totalLength > MAX_BUFFER_SIZE && buffer.chunks.length > 1) {
        const removed = buffer.chunks.shift()!;
        buffer.totalLength -= removed.length;
      }
    });

    this._buffers.set(sessionId, buffer);
    this._resetInactivityTimer(sessionId);
  }

  drainBuffer(sessionId: string, data$: Observable<Uint8Array | string>, timeoutMs: number): Promise<string> {
    const buffer = this._buffers.get(sessionId);

    if (buffer) {
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          const output = buffer.chunks.join('');
          buffer.chunks.length = 0;
          buffer.totalLength = 0;
          this._resetInactivityTimer(sessionId);
          resolve(output);
        }, timeoutMs);
      });
    }

    // No buffer (no prior execute): fall back to immediate subscribe
    return new Promise<string>((resolve) => {
      const chunks: string[] = [];
      const decoder = new TextDecoder('utf-8');

      const subscription = data$.subscribe((data) => {
        chunks.push(typeof data === 'string' ? data : decoder.decode(data as Uint8Array, { stream: true }));
      });

      setTimeout(() => {
        subscription.unsubscribe();
        resolve(chunks.join(''));
      }, timeoutMs);
    });
  }

  cleanup(): void {
    for (const sessionId of this._buffers.keys()) {
      this._cleanupBuffer(sessionId);
    }
  }

  removeBuffer(sessionId: string): void {
    this._cleanupBuffer(sessionId);
  }

  private _resetInactivityTimer(sessionId: string): void {
    const buffer = this._buffers.get(sessionId);
    if (!buffer) return;

    if (buffer.inactivityTimer !== null) {
      clearTimeout(buffer.inactivityTimer);
    }

    buffer.inactivityTimer = setTimeout(() => {
      this._cleanupBuffer(sessionId);
    }, BUFFER_INACTIVITY_TIMEOUT);
  }

  private _cleanupBuffer(sessionId: string): void {
    const buffer = this._buffers.get(sessionId);
    if (!buffer) return;

    buffer.subscription.unsubscribe();
    if (buffer.inactivityTimer !== null) {
      clearTimeout(buffer.inactivityTimer);
    }
    this._buffers.delete(sessionId);
  }
}
