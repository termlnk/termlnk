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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeTerminalOutputFrame, encodeTerminalOutputFrame, isTerminalOutputAckMessage, isTerminalOutputOpenRequest, parseTerminalOutputServerMessage, TERMINAL_OUTPUT_ACK_INTERVAL_MS, TERMINAL_OUTPUT_MAX_FRAME_BYTES } from '../../models/terminal-output';
import { TerminalOutputAckBuffer } from '../terminal-output-ack-buffer';

describe('TerminalOutputAckBuffer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches contiguous parser acknowledgements by bytes', () => {
    const send = vi.fn();
    const buffer = new TerminalOutputAckBuffer(send);

    buffer.acknowledge(10, TERMINAL_OUTPUT_MAX_FRAME_BYTES);
    buffer.acknowledge(11, TERMINAL_OUTPUT_MAX_FRAME_BYTES);

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(11);
    buffer.dispose();
  });

  it('flushes a partial batch after the acknowledgement interval', () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const buffer = new TerminalOutputAckBuffer(send);

    buffer.acknowledge(3, 1);
    vi.advanceTimersByTime(TERMINAL_OUTPUT_ACK_INTERVAL_MS);

    expect(send).toHaveBeenCalledWith(3);
    buffer.dispose();
  });

  it('does not regress a cumulative acknowledgement when callbacks arrive out of order', () => {
    const send = vi.fn();
    const buffer = new TerminalOutputAckBuffer(send);

    buffer.acknowledge(11, TERMINAL_OUTPUT_MAX_FRAME_BYTES);
    buffer.acknowledge(10, TERMINAL_OUTPUT_MAX_FRAME_BYTES);

    expect(send).toHaveBeenCalledWith(11);
    buffer.dispose();
  });

  it('advances cumulative acknowledgements across the 32-bit sequence boundary', () => {
    const send = vi.fn();
    const buffer = new TerminalOutputAckBuffer(send);

    buffer.acknowledge(0xFFFFFFFF, TERMINAL_OUTPUT_MAX_FRAME_BYTES);
    buffer.acknowledge(0, TERMINAL_OUTPUT_MAX_FRAME_BYTES);

    expect(send).toHaveBeenCalledWith(0);
    buffer.dispose();
  });
});

describe('terminal output frame codec', () => {
  it('preserves sequence and raw bytes', () => {
    const encoded = encodeTerminalOutputFrame(0xFFFFFFFF, new Uint8Array([0x00, 0x80, 0xFF]));
    const decoded = decodeTerminalOutputFrame(encoded.buffer);

    expect(decoded.sequence).toBe(0xFFFFFFFF);
    expect([...decoded.data]).toEqual([0x00, 0x80, 0xFF]);
  });

  it('rejects a frame without a complete header', () => {
    expect(() => decodeTerminalOutputFrame(new ArrayBuffer(3))).toThrow(/too short/);
  });

  it('rejects frames that violate protocol bounds', () => {
    expect(() => encodeTerminalOutputFrame(-1, new Uint8Array())).toThrow(/sequence/);
    expect(() => encodeTerminalOutputFrame(0, new Uint8Array(TERMINAL_OUTPUT_MAX_FRAME_BYTES + 1))).toThrow(/exceeds/);
    expect(() => decodeTerminalOutputFrame(new ArrayBuffer(TERMINAL_OUTPUT_MAX_FRAME_BYTES + 5))).toThrow(/exceeds/);
  });

  it('validates structured protocol messages at runtime', () => {
    expect(isTerminalOutputOpenRequest({ requestId: 'request-1', source: 'pty', sessionId: 'session-1' })).toBe(true);
    expect(isTerminalOutputOpenRequest({ requestId: '', source: 'pty', sessionId: 'session-1' })).toBe(false);
    expect(isTerminalOutputAckMessage({ type: 'ack', sequence: 0xFFFFFFFF })).toBe(true);
    expect(isTerminalOutputAckMessage({ type: 'ack', sequence: -1 })).toBe(false);

    const data = new Uint8Array([0xF0, 0x9F, 0x98, 0x80]);
    expect(parseTerminalOutputServerMessage({ type: 'data', sequence: 1, data })).toEqual({ type: 'data', sequence: 1, data });
    expect(() => parseTerminalOutputServerMessage({ type: 'data', sequence: 1, data: 'base64' })).toThrow(/Invalid/);
  });
});
