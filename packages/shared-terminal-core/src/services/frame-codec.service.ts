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

import type {
  IFrame,
  IFrameCodecService,
  ISharedKey,
  ISharedTerminalCryptoService,
} from '@termlnk/shared-terminal';
import { Inject } from '@termlnk/core';
import {
  FrameChannel,
  ISharedTerminalCryptoService as ISharedTerminalCryptoServiceId,
  SHARED_TERMINAL_FRAME_PREFIX,
  SHARED_TERMINAL_FRAME_VERSION,
} from '@termlnk/shared-terminal';

/**
 * Wire frame layout — see architecture §5.2 and the `IFrameCodecService`
 * header comment in the contract package.
 *
 * Plaintext (about to enter secretbox):
 *   ver(1) | ch(1) | flags(1) | seq(4 LE u32) | payload(N)   ← 7-byte header
 *
 * Ciphertext (NaCl secretbox output appends a 16-byte Poly1305 tag):
 *   "tmst1:"(6) | nonce(24) | secretbox(plaintext)
 */
const FRAME_HEADER_BYTES = 7;
const FRAME_PREFIX_BYTES = textEncoder().encode(SHARED_TERMINAL_FRAME_PREFIX);

export class FrameCodecService implements IFrameCodecService {
  constructor(
    @Inject(ISharedTerminalCryptoServiceId) private readonly _crypto: ISharedTerminalCryptoService
  ) {}

  encodePlain(frame: IFrame): Uint8Array {
    if (!isKnownChannel(frame.channel)) {
      throw new Error(`[FrameCodecService] unknown channel ${frame.channel}`);
    }
    if (frame.flags < 0 || frame.flags > 0xFF) {
      throw new Error(`[FrameCodecService] flags must be uint8, got ${frame.flags}`);
    }
    if (!Number.isInteger(frame.seq) || frame.seq < 0 || frame.seq > 0xFFFFFFFF) {
      throw new Error(`[FrameCodecService] seq must be uint32, got ${frame.seq}`);
    }

    const out = new Uint8Array(FRAME_HEADER_BYTES + frame.payload.length);
    out[0] = SHARED_TERMINAL_FRAME_VERSION;
    out[1] = frame.channel;
    out[2] = frame.flags & 0xFF;
    // 32-bit LE seq.
    out[3] = frame.seq & 0xFF;
    out[4] = (frame.seq >>> 8) & 0xFF;
    out[5] = (frame.seq >>> 16) & 0xFF;
    out[6] = (frame.seq >>> 24) & 0xFF;
    out.set(frame.payload, FRAME_HEADER_BYTES);
    return out;
  }

  decodePlain(bytes: Uint8Array): IFrame {
    if (bytes.length < FRAME_HEADER_BYTES) {
      throw new Error(`[FrameCodecService] frame too short: ${bytes.length} < ${FRAME_HEADER_BYTES}`);
    }
    const version = bytes[0]!;
    if (version !== SHARED_TERMINAL_FRAME_VERSION) {
      throw new Error(`[FrameCodecService] unsupported frame version ${version}`);
    }
    const channel = bytes[1]!;
    if (!isKnownChannel(channel)) {
      throw new Error(`[FrameCodecService] unknown channel ${channel}`);
    }
    const flags = bytes[2]!;
    // 32-bit LE seq — use multiplication for the high bytes to avoid JS
    // bitwise ops overflowing into int32 (0xFFFFFFFF | 0 → -1).
    const seq = bytes[3]! + bytes[4]! * 0x100 + bytes[5]! * 0x10000 + bytes[6]! * 0x1000000;
    const payload = bytes.slice(FRAME_HEADER_BYTES);
    return { channel, flags, seq, payload };
  }

  encrypt(frame: IFrame, sharedKey: ISharedKey): Uint8Array {
    const plain = this.encodePlain(frame);
    const enc = this._crypto.secretBox(plain, sharedKey);
    const out = new Uint8Array(FRAME_PREFIX_BYTES.length + enc.length);
    out.set(FRAME_PREFIX_BYTES, 0);
    out.set(enc, FRAME_PREFIX_BYTES.length);
    return out;
  }

  decrypt(wireBytes: Uint8Array, sharedKey: ISharedKey): IFrame {
    if (wireBytes.length < FRAME_PREFIX_BYTES.length) {
      throw new Error('[FrameCodecService] wire bytes too short for prefix');
    }
    for (let i = 0; i < FRAME_PREFIX_BYTES.length; i++) {
      if (wireBytes[i] !== FRAME_PREFIX_BYTES[i]) {
        throw new Error('[FrameCodecService] invalid frame prefix');
      }
    }
    const cipher = wireBytes.subarray(FRAME_PREFIX_BYTES.length);
    const plain = this._crypto.secretBoxOpen(cipher, sharedKey);
    return this.decodePlain(plain);
  }
}

function isKnownChannel(value: number): value is FrameChannel {
  return value === FrameChannel.Control || value === FrameChannel.PtyData || value === FrameChannel.SessionEvent;
}

function textEncoder(): TextEncoder {
  return new TextEncoder();
}
