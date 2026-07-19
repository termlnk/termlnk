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

export const TERMINAL_OUTPUT_MAX_FRAME_BYTES = 64 * 1024;
export const TERMINAL_OUTPUT_CREDIT_BYTES = 256 * 1024;
export const TERMINAL_OUTPUT_CREDIT_FRAMES = 8;
export const TERMINAL_OUTPUT_FRAME_INTERVAL_MS = 8;
export const TERMINAL_OUTPUT_ACK_BATCH_BYTES = 128 * 1024;
export const TERMINAL_OUTPUT_ACK_INTERVAL_MS = 8;

export const TERMINAL_OUTPUT_ELECTRON_OPEN_CHANNEL = 'termlnk:terminal-output:open';
export const TERMINAL_OUTPUT_ELECTRON_CANCEL_CHANNEL = 'termlnk:terminal-output:cancel';
export const TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL = 'termlnk:terminal-output:port';
export const TERMINAL_OUTPUT_WEB_SOCKET_PATH = '/terminal-output';

export type TerminalOutputSourceType = 'pty' | 'ssh';

export interface ITerminalOutputOpenRequest {
  readonly requestId: string;
  readonly source: TerminalOutputSourceType;
  readonly sessionId: string;
}

export interface ITerminalOutputDataMessage {
  readonly type: 'data';
  readonly sequence: number;
  readonly data: Uint8Array;
}

export interface ITerminalOutputAckMessage {
  readonly type: 'ack';
  readonly sequence: number;
}

export interface ITerminalOutputCloseMessage {
  readonly type: 'close';
}

export interface ITerminalOutputErrorMessage {
  readonly type: 'error';
  readonly message: string;
}

export type TerminalOutputServerMessage = ITerminalOutputDataMessage | ITerminalOutputCloseMessage | ITerminalOutputErrorMessage;
export type TerminalOutputClientMessage = ITerminalOutputAckMessage;

const TERMINAL_OUTPUT_FRAME_HEADER_BYTES = 4;
const TERMINAL_OUTPUT_MAX_SEQUENCE = 0xFFFFFFFF;

export function isTerminalOutputOpenRequest(value: unknown): value is ITerminalOutputOpenRequest {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.requestId === 'string'
    && value.requestId.length > 0
    && typeof value.sessionId === 'string'
    && value.sessionId.length > 0
    && (value.source === 'pty' || value.source === 'ssh');
}

export function isTerminalOutputAckMessage(value: unknown): value is ITerminalOutputAckMessage {
  if (!isRecord(value)) {
    return false;
  }
  return value.type === 'ack' && isTerminalOutputSequence(value.sequence);
}

export function parseTerminalOutputServerMessage(value: unknown): TerminalOutputServerMessage {
  if (!isRecord(value)) {
    throw new Error('Terminal output server message must be an object');
  }
  if (value.type === 'close') {
    return { type: 'close' };
  }
  if (value.type === 'error' && typeof value.message === 'string') {
    return { type: 'error', message: value.message };
  }
  if (
    value.type === 'data'
    && isTerminalOutputSequence(value.sequence)
    && value.data instanceof Uint8Array
    && value.data.byteLength <= TERMINAL_OUTPUT_MAX_FRAME_BYTES
  ) {
    return { type: 'data', sequence: value.sequence, data: value.data };
  }
  throw new Error('Invalid terminal output server message');
}

export function encodeTerminalOutputFrame(sequence: number, data: Uint8Array): Uint8Array {
  if (!isTerminalOutputSequence(sequence)) {
    throw new Error(`Invalid terminal output sequence: ${sequence}`);
  }
  if (data.byteLength > TERMINAL_OUTPUT_MAX_FRAME_BYTES) {
    throw new Error(`Terminal output frame exceeds ${TERMINAL_OUTPUT_MAX_FRAME_BYTES} bytes`);
  }
  const frame = new Uint8Array(TERMINAL_OUTPUT_FRAME_HEADER_BYTES + data.byteLength);
  new DataView(frame.buffer).setUint32(0, sequence, true);
  frame.set(data, TERMINAL_OUTPUT_FRAME_HEADER_BYTES);
  return frame;
}

export function decodeTerminalOutputFrame(frame: ArrayBufferLike): ITerminalOutputDataMessage {
  if (frame.byteLength < TERMINAL_OUTPUT_FRAME_HEADER_BYTES) {
    throw new Error(`Terminal output frame is too short: ${frame.byteLength}`);
  }
  if (frame.byteLength > TERMINAL_OUTPUT_FRAME_HEADER_BYTES + TERMINAL_OUTPUT_MAX_FRAME_BYTES) {
    throw new Error(`Terminal output frame exceeds ${TERMINAL_OUTPUT_MAX_FRAME_BYTES} data bytes`);
  }

  const sequence = new DataView(frame).getUint32(0, true);
  const data = new Uint8Array(frame, TERMINAL_OUTPUT_FRAME_HEADER_BYTES);
  return { type: 'data', sequence, data };
}

function isTerminalOutputSequence(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= TERMINAL_OUTPUT_MAX_SEQUENCE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
