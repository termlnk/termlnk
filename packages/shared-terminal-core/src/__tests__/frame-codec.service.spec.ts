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

import { FrameChannel, FrameFlag, SHARED_TERMINAL_FRAME_PREFIX } from '@termlnk/shared-terminal';
import { describe, expect, it } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { FrameCodecService } from '../services/frame-codec.service';

function createCodec(): { codec: FrameCodecService; crypto: SharedTerminalCryptoService } {
  const crypto = new SharedTerminalCryptoService();
  const codec = new FrameCodecService(crypto);
  return { codec, crypto };
}

describe('frameCodecService — encodePlain / decodePlain round-trip', () => {
  it('round-trips a control frame', () => {
    const { codec } = createCodec();
    const frame = {
      channel: FrameChannel.Control,
      flags: FrameFlag.AckRequired,
      seq: 42,
      payload: new TextEncoder().encode('{"type":"heartbeat"}'),
    };
    const encoded = codec.encodePlain(frame);
    const decoded = codec.decodePlain(encoded);
    expect(decoded.channel).toBe(FrameChannel.Control);
    expect(decoded.flags).toBe(FrameFlag.AckRequired);
    expect(decoded.seq).toBe(42);
    expect(decoded.payload).toEqual(frame.payload);
  });

  it('round-trips a 1KB pty data frame', () => {
    const { codec } = createCodec();
    const payload = new Uint8Array(1024);
    for (let i = 0; i < payload.length; i++) {
      payload[i] = i & 0xFF;
    }
    const frame = {
      channel: FrameChannel.PtyData,
      flags: FrameFlag.None,
      seq: 0xDEADBEEF & 0x7FFFFFFF, // safe positive uint32
      payload,
    };
    const decoded = codec.decodePlain(codec.encodePlain(frame));
    expect(decoded.seq).toBe(frame.seq);
    expect(decoded.payload).toEqual(payload);
  });

  it('preserves uint32 seq at boundary 0xFFFFFFFF', () => {
    const { codec } = createCodec();
    const frame = {
      channel: FrameChannel.PtyData,
      flags: FrameFlag.None,
      seq: 0xFFFFFFFF,
      payload: new Uint8Array(0),
    };
    const decoded = codec.decodePlain(codec.encodePlain(frame));
    expect(decoded.seq).toBe(0xFFFFFFFF);
  });

  it('rejects unknown channel', () => {
    const { codec } = createCodec();
    expect(() =>
      codec.encodePlain({ channel: 99 as FrameChannel, flags: 0, seq: 0, payload: new Uint8Array(0) })
    ).toThrow(/unknown channel/);
  });

  it('rejects flags out of uint8 range', () => {
    const { codec } = createCodec();
    expect(() =>
      codec.encodePlain({ channel: FrameChannel.Control, flags: 256, seq: 0, payload: new Uint8Array(0) })
    ).toThrow(/flags must be uint8/);
  });

  it('rejects seq out of uint32 range', () => {
    const { codec } = createCodec();
    expect(() =>
      codec.encodePlain({
        channel: FrameChannel.Control,
        flags: 0,
        seq: 0xFFFFFFFF + 1,
        payload: new Uint8Array(0),
      })
    ).toThrow(/seq must be uint32/);
  });

  it('decodePlain rejects too-short bytes', () => {
    const { codec } = createCodec();
    expect(() => codec.decodePlain(new Uint8Array(3))).toThrow(/too short/);
  });

  it('decodePlain rejects unsupported version', () => {
    const { codec } = createCodec();
    const bytes = new Uint8Array([99, 0, 0, 0, 0, 0, 0]);
    expect(() => codec.decodePlain(bytes)).toThrow(/unsupported frame version/);
  });
});

describe('frameCodecService — encrypt / decrypt round-trip', () => {
  it('encrypts and decrypts with shared key', () => {
    const { codec, crypto } = createCodec();
    const alice = crypto.generateKeypair();
    const bob = crypto.generateKeypair();
    const sk = crypto.deriveSharedKey(bob.publicKey, alice.secretKey);

    const frame = {
      channel: FrameChannel.PtyData,
      flags: FrameFlag.None,
      seq: 7,
      payload: new TextEncoder().encode('echo "hi"\r\n'),
    };
    const wire = codec.encrypt(frame, sk);
    expect(new TextDecoder().decode(wire.subarray(0, SHARED_TERMINAL_FRAME_PREFIX.length))).toBe(
      SHARED_TERMINAL_FRAME_PREFIX
    );
    const decoded = codec.decrypt(wire, sk);
    expect(decoded.channel).toBe(FrameChannel.PtyData);
    expect(decoded.seq).toBe(7);
    expect(decoded.payload).toEqual(frame.payload);
  });

  it('decrypt rejects wrong shared key', () => {
    const { codec, crypto } = createCodec();
    const sk1 = { bytes: crypto.generateSessionKey() };
    const sk2 = { bytes: crypto.generateSessionKey() };
    const frame = {
      channel: FrameChannel.Control,
      flags: 0,
      seq: 1,
      payload: new Uint8Array([0xAB, 0xCD]),
    };
    const wire = codec.encrypt(frame, sk1);
    expect(() => codec.decrypt(wire, sk2)).toThrow(/decryption failed/);
  });

  it('decrypt rejects tampered prefix', () => {
    const { codec, crypto } = createCodec();
    const sk = { bytes: crypto.generateSessionKey() };
    const wire = codec.encrypt(
      { channel: FrameChannel.Control, flags: 0, seq: 0, payload: new Uint8Array(4) },
      sk
    );
    wire[0] = 'X'.charCodeAt(0);
    expect(() => codec.decrypt(wire, sk)).toThrow(/invalid frame prefix/);
  });
});
