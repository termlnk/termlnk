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

import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../utils/ring-buffer';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('ringBuffer', () => {
  it('rejects non-positive capacity', () => {
    expect(() => new RingBuffer(0)).toThrow();
    expect(() => new RingBuffer(-1)).toThrow();
    expect(() => new RingBuffer(1.5)).toThrow();
  });

  it('starts empty', () => {
    const rb = new RingBuffer(10);
    expect(rb.size).toBe(0);
    expect(rb.full).toBe(false);
    expect(rb.snapshot()).toEqual(new Uint8Array(0));
  });

  it('writes without wrap', () => {
    const rb = new RingBuffer(10);
    rb.write(bytes(1, 2, 3));
    expect(rb.size).toBe(3);
    expect(rb.snapshot()).toEqual(bytes(1, 2, 3));
  });

  it('fills exactly to capacity', () => {
    const rb = new RingBuffer(5);
    rb.write(bytes(1, 2, 3, 4, 5));
    expect(rb.size).toBe(5);
    expect(rb.full).toBe(true);
    expect(rb.snapshot()).toEqual(bytes(1, 2, 3, 4, 5));
  });

  it('wraps around — keeps newest bytes in chronological order', () => {
    const rb = new RingBuffer(5);
    rb.write(bytes(1, 2, 3, 4, 5));
    rb.write(bytes(6, 7));
    expect(rb.size).toBe(5);
    // 1,2 evicted; ring contents in order: 3,4,5,6,7
    expect(rb.snapshot()).toEqual(bytes(3, 4, 5, 6, 7));
  });

  it('handles single-write larger than capacity (tail-only)', () => {
    const rb = new RingBuffer(4);
    rb.write(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
    expect(rb.size).toBe(4);
    expect(rb.snapshot()).toEqual(bytes(7, 8, 9, 10));
  });

  it('handles many small writes that wrap multiple times', () => {
    const rb = new RingBuffer(3);
    for (let i = 1; i <= 10; i++) {
      rb.write(bytes(i));
    }
    expect(rb.snapshot()).toEqual(bytes(8, 9, 10));
  });

  it('clear resets state', () => {
    const rb = new RingBuffer(5);
    rb.write(bytes(1, 2, 3));
    rb.clear();
    expect(rb.size).toBe(0);
    expect(rb.snapshot()).toEqual(new Uint8Array(0));

    rb.write(bytes(4, 5));
    expect(rb.snapshot()).toEqual(bytes(4, 5));
  });

  it('write of empty array is no-op', () => {
    const rb = new RingBuffer(5);
    rb.write(new Uint8Array(0));
    expect(rb.size).toBe(0);
  });

  it('snapshot returns a copy (caller mutations do not affect buffer)', () => {
    const rb = new RingBuffer(5);
    rb.write(bytes(1, 2, 3));
    const snap = rb.snapshot();
    snap[0] = 99;
    expect(rb.snapshot()).toEqual(bytes(1, 2, 3));
  });
});
