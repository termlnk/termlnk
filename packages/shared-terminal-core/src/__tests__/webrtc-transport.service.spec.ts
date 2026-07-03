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
import type { IFrameCodecService, ISharedKey, ITransportConnectOptions } from '@termlnk/shared-terminal';
import { TransportState } from '@termlnk/shared-terminal';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebRTCTransportService } from '../services/webrtc-transport.service';

class FakeLogService implements ILogService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  log = vi.fn();
  deprecate = vi.fn();
  setLogLevel = vi.fn();
}

class FakeDataChannel {
  readyState = 'open';
  binaryType = 'arraybuffer';
  bufferedAmount = 0;
  onopen: ((evt: any) => void) | null = null;
  onmessage: ((evt: { data: any }) => void) | null = null;
  onclose: ((evt: any) => void) | null = null;
  onerror: ((evt: any) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
}

class FakePeerConnection {
  closeCalls = 0;
  iceConnectionState = 'new';
  onicecandidate: ((evt: any) => void) | null = null;
  ondatachannel: ((evt: any) => void) | null = null;
  oniceconnectionstatechange: ((evt: any) => void) | null = null;
  readonly channels: FakeDataChannel[] = [];

  createDataChannel(): FakeDataChannel {
    const channel = new FakeDataChannel();
    this.channels.push(channel);
    return channel;
  }

  async createOffer(): Promise<{ type: string; sdp: string }> {
    return { type: 'offer', sdp: 'offer-sdp' };
  }

  async createAnswer(): Promise<{ type: string; sdp: string }> {
    return { type: 'answer', sdp: 'answer-sdp' };
  }

  async setLocalDescription(): Promise<void> {}

  async setRemoteDescription(): Promise<void> {}

  async addIceCandidate(): Promise<void> {}

  close(): void {
    this.closeCalls++;
  }
}

class FakeSignalingSocket {
  readyState = 1;
  readonly sent: string[] = [];
  private readonly _listeners = new Map<string, Array<(event: any) => void>>();

  constructor(
    readonly url: string,
    readonly protocols?: string[]
  ) {}

  send(data: string | Uint8Array): void {
    this.sent.push(String(data));
  }

  close(): void {
    this.emit('close', {});
  }

  addEventListener(type: string, listener: (event: any) => void): void {
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

const OPTIONS: ITransportConnectOptions = {
  relayBaseUrl: 'wss://relay.example.test/v1',
  sessionId: 'session-1',
  accountToken: 'token-1',
  mode: 'client',
};

const KEY: ISharedKey = { bytes: new Uint8Array(32).fill(1) };

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('WebRTCTransportService peer leg cleanup', () => {
  let sockets: FakeSignalingSocket[];
  let pcs: FakePeerConnection[];
  let service: WebRTCTransportService;

  beforeEach(() => {
    sockets = [];
    pcs = [];
    vi.stubGlobal('WebSocket', class extends FakeSignalingSocket {
      constructor(url: string, protocols?: string[]) {
        super(url, protocols);
        sockets.push(this);
      }
    });
    vi.stubGlobal('RTCPeerConnection', class extends FakePeerConnection {
      constructor() {
        super();
        pcs.push(this);
      }
    });
    const codecStub: IFrameCodecService = {
      encode: vi.fn(),
      decode: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    } as unknown as IFrameCodecService;
    service = new WebRTCTransportService(codecStub, new FakeLogService());
  });

  afterEach(() => {
    service.dispose();
    vi.unstubAllGlobals();
  });

  async function connectAsClient(): Promise<void> {
    const promise = service.connect(OPTIONS, KEY);
    sockets[0]!.emit('open', {});
    await tick();
    sockets[0]!.emit('message', {
      data: JSON.stringify({ type: 'ready', peerId: 'me', peers: ['daemon-1'], iceServers: [] }),
    });
    await promise;
  }

  it('closes the peer connection when its data channel closes', async () => {
    await connectAsClient();
    const pc = pcs[0]!;
    const channel = pc.channels[0]!;
    channel.onopen!({});

    const states: TransportState[] = [];
    service.state$.subscribe((state) => states.push(state));

    channel.onclose!({});

    expect(pc.closeCalls).toBe(1);
    expect(states.at(-1)).toBe(TransportState.Disconnected);
  });

  it('closes the peer connection when ICE fails', async () => {
    await connectAsClient();
    const pc = pcs[0]!;
    pc.channels[0]!.onopen!({});

    pc.iceConnectionState = 'failed';
    pc.oniceconnectionstatechange!({});

    expect(pc.closeCalls).toBe(1);
  });

  it('does not double-close a leg already reaped by channel close', async () => {
    await connectAsClient();
    const pc = pcs[0]!;
    pc.channels[0]!.onopen!({});
    pc.channels[0]!.onclose!({});
    expect(pc.closeCalls).toBe(1);

    // Explicit teardown afterwards must not close the reaped leg again.
    await service.disconnect();
    expect(pc.closeCalls).toBe(1);
  });

  it('still closes remaining legs on teardown', async () => {
    await connectAsClient();
    const pc = pcs[0]!;
    pc.channels[0]!.onopen!({});

    await service.disconnect();
    expect(pc.closeCalls).toBe(1);
  });
});
