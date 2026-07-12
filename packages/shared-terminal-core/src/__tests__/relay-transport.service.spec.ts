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

import type { ILogService } from '@termlnk/core';
import type { IFrame } from '@termlnk/shared-terminal';
import type { IRelayWebSocket } from '../services/relay-transport.service';
import { FrameChannel, FrameFlag, TransportState } from '@termlnk/shared-terminal';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { FrameCodecService } from '../services/frame-codec.service';
import { RelayTransportService } from '../services/relay-transport.service';

class FakeLogService implements ILogService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  log = vi.fn();
  deprecate = vi.fn();
  setLogLevel = vi.fn();
}

class FakeWebSocket implements IRelayWebSocket {
  readonly sent: Array<string | Uint8Array> = [];
  private readonly _listeners = new Map<string, Array<(event: any) => void>>();

  constructor(
    readonly url: string,
    readonly protocols?: string[]
  ) {}

  send(data: string | Uint8Array): void {
    this.sent.push(data);
  }

  close(): void {
    this.emit('close', {});
  }

  addEventListener(type: 'open' | 'close' | 'error' | 'message', listener: (event: any) => void): void {
    const listeners = this._listeners.get(type) ?? [];
    listeners.push(listener);
    this._listeners.set(type, listeners);
  }

  emit(type: string, event: any): void {
    for (const listener of this._listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function frame(payload: string): IFrame {
  return {
    channel: FrameChannel.Control,
    flags: FrameFlag.None,
    seq: 1,
    payload: new TextEncoder().encode(payload),
  };
}

describe('RelayTransportService', () => {
  let sockets: FakeWebSocket[];
  let service: RelayTransportService;
  let codec: FrameCodecService;

  beforeEach(() => {
    sockets = [];
    const ctor = class extends FakeWebSocket {
      constructor(url: string, protocols?: string[]) {
        super(url, protocols);
        sockets.push(this);
      }
    };
    const crypto = new SharedTerminalCryptoService();
    codec = new FrameCodecService(crypto);
    service = new RelayTransportService(codec, new FakeLogService(), {
      webSocketCtor: ctor,
    });
  });

  it('connects with relay query params and bearer subprotocol', async () => {
    const states: TransportState[] = [];
    service.state$.subscribe((state) => states.push(state));

    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      accountToken: 'token-1',
      mode: 'client',
    }, { bytes: new Uint8Array(32).fill(1) });
    sockets[0]!.emit('open', {});
    await connectPromise;

    expect(sockets[0]!.url).toContain('/v1/shared-terminal?');
    expect(sockets[0]!.url).toContain('mode=client');
    expect(sockets[0]!.url).toContain('sessionId=session-1');
    expect(sockets[0]!.protocols).toEqual(['Bearer.token-1']);
    expect(states).toContain(TransportState.Connected);
  });

  it('encrypts outbound frame into relay envelope', async () => {
    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      accountToken: 'token-1',
      mode: 'daemon',
    }, { bytes: new Uint8Array(32).fill(2) });
    sockets[0]!.emit('open', {});
    await connectPromise;

    service.send(frame('hello'), { target: 'broadcast' });
    const sent = JSON.parse(sockets[0]!.sent[0] as string) as { type: string; target: string; payload: string };

    expect(sent.type).toBe('frame');
    expect(sent.target).toBe('broadcast');
    expect(sent.payload).toEqual(expect.any(String));
  });

  it('decrypts inbound relay envelope to frames$', async () => {
    const received: string[] = [];
    const key = { bytes: new Uint8Array(32).fill(3) };
    service.frames$.subscribe((inbound) => {
      received.push(new TextDecoder().decode(inbound.frame.payload));
    });
    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      accountToken: 'token-1',
      mode: 'client',
    }, key);
    sockets[0]!.emit('open', {});
    await connectPromise;

    const encrypted = codec.encrypt(frame('from-daemon'), key);
    let binary = '';
    for (let i = 0; i < encrypted.length; i++) {
      binary += String.fromCharCode(encrypted[i]!);
    }
    sockets[0]!.emit('message', {
      data: JSON.stringify({
        type: 'frame',
        source: 'daemon',
        payload: btoa(binary),
      }),
    });

    expect(received).toEqual(['from-daemon']);
  });

  it('surfaces relay peer_left envelopes on peerLeft$', async () => {
    const left: string[] = [];
    service.peerLeft$.subscribe((id) => left.push(id));
    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      accountToken: 'token-1',
      mode: 'daemon',
    }, { bytes: new Uint8Array(32).fill(7) });
    sockets[0]!.emit('open', {});
    await connectPromise;

    // peer_left is a plaintext control envelope (relay holds no session key),
    // recognised before the frame-decrypt path — same shape as ready/pong/error.
    sockets[0]!.emit('message', {
      data: JSON.stringify({ type: 'peer_left', connectionId: 'c1' }),
    });

    expect(left).toEqual(['c1']);
  });

  it('rejects daemon-only operations in client mode', async () => {
    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      accountToken: 'token-1',
      mode: 'client',
    }, { bytes: new Uint8Array(32).fill(4) });
    sockets[0]!.emit('open', {});
    await connectPromise;

    // rekey is deliberately mode-agnostic: client transports feed the
    // re-wrapped session key back through it (see rekey() JSDoc), so only
    // revokeConnection is daemon-gated.
    await expect(service.rekey(new Uint8Array(32).fill(5))).resolves.toBeUndefined();
    await expect(service.revokeConnection('c1')).rejects.toThrow(/daemon mode/);
  });

  it('rejects connect when the WebSocket closes before opening', async () => {
    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      accountToken: 'bad-token',
      mode: 'client',
    }, { bytes: new Uint8Array(32).fill(6) });
    // Server rejected upgrade (e.g. 401 unauth) — runtime emits 'close' with no
    // prior 'open'. The connect promise must surface the failure instead of
    // silently resolving and leaving the caller to think the join succeeded.
    sockets[0]!.emit('close', {});
    await expect(connectPromise).rejects.toThrow(/closed before open/);
  });

  it('connects with only the relay-claim subprotocol for anonymous joiners', async () => {
    // Anonymous joiners have no JWT — the relay routes them into the owner's
    // bucket off the one-shot RelayToken alone, so accountToken must be absent.
    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      mode: 'client',
      relayClaimToken: 'claim-token-1',
    }, { bytes: new Uint8Array(32).fill(8) });
    sockets[0]!.emit('open', {});
    await connectPromise;

    expect(sockets[0]!.protocols).toEqual(['RelayToken.claim-token-1']);
  });

  it('connects with both subprotocols, bearer before relay-claim token', async () => {
    // Cross-account joiner attaching with both a JWT and a relay-claim token —
    // order matters for the server-side parser, which reads Bearer first.
    const connectPromise = service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      mode: 'client',
      accountToken: 'account-token-a',
      relayClaimToken: 'claim-token-b',
    }, { bytes: new Uint8Array(32).fill(9) });
    sockets[0]!.emit('open', {});
    await connectPromise;

    expect(sockets[0]!.protocols).toEqual(['Bearer.account-token-a', 'RelayToken.claim-token-b']);
  });

  it('rejects connect synchronously when neither accountToken nor relayClaimToken is provided', async () => {
    await expect(service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      mode: 'client',
    }, { bytes: new Uint8Array(32).fill(10) })).rejects.toThrow(/accountToken or relayClaimToken/);
    // No socket should have been opened — the guard fires before _openSocket.
    expect(sockets).toHaveLength(0);
  });

  it('rejects daemon-mode connect with only a relayClaimToken (no accountToken)', async () => {
    // A relay-claim token identifies an anonymous joiner, not the owner's
    // account bucket — daemon sockets must present a Bearer JWT regardless
    // of what other credential is attached.
    await expect(service.connect({
      relayBaseUrl: 'wss://relay.example.test/v1',
      sessionId: 'session-1',
      mode: 'daemon',
      relayClaimToken: 'claim-token-1',
    }, { bytes: new Uint8Array(32).fill(11) })).rejects.toThrow(/daemon mode requires accountToken/);
    // No socket should have been opened — the guard fires before _openSocket.
    expect(sockets).toHaveLength(0);
  });
});
