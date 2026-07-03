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
import type { IInboundFrame, ISharedKey, ITransportConnectOptions } from '@termlnk/shared-terminal';
import type { RelayTransportService } from '../services/relay-transport.service';
import type { WebRTCTransportService } from '../services/webrtc-transport.service';
import { TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositeTransportService } from '../services/composite-transport.service';

class FakeLogService implements ILogService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  log = vi.fn();
  deprecate = vi.fn();
  setLogLevel = vi.fn();
}

class FakeTransport {
  readonly state$ = new BehaviorSubject<TransportState>(TransportState.Idle);
  readonly frames$ = new Subject<IInboundFrame>();
  connectCalls = 0;
  disconnectCalls = 0;
  supported = true;

  isSupported(): boolean {
    return this.supported;
  }

  async connect(): Promise<void> {
    this.connectCalls++;
    this.state$.next(TransportState.Connected);
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls++;
    this.state$.next(TransportState.Disconnected);
  }

  send(): void {}

  async rekey(): Promise<void> {}

  async revokeConnection(): Promise<void> {}
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

describe('CompositeTransportService', () => {
  let webrtc: FakeTransport;
  let relay: FakeTransport;
  let service: CompositeTransportService;
  let paths: Array<string | null>;

  beforeEach(() => {
    webrtc = new FakeTransport();
    relay = new FakeTransport();
    service = new CompositeTransportService(
      webrtc as unknown as WebRTCTransportService,
      relay as unknown as RelayTransportService,
      new FakeLogService()
    );
    paths = [];
    service.activePath$.subscribe((path) => paths.push(path));
  });

  it('uses webrtc as primary path when it connects', async () => {
    await service.connect(OPTIONS, KEY);

    expect(webrtc.connectCalls).toBe(1);
    expect(relay.connectCalls).toBe(0);
    expect(paths.at(-1)).toBe('webrtc');
  });

  it('fails over to relay when webrtc drops mid-session', async () => {
    await service.connect(OPTIONS, KEY);

    webrtc.state$.next(TransportState.Disconnected);
    await tick();

    expect(relay.connectCalls).toBe(1);
    expect(paths.at(-1)).toBe('relay');
  });

  it('does not fail over to relay during an intentional disconnect', async () => {
    await service.connect(OPTIONS, KEY);

    await service.disconnect();
    await tick();

    // webrtc.disconnect() emits Disconnected synchronously while _activePath$
    // was still 'webrtc' before the fix — the drop watcher must not treat
    // this as a mid-session drop and open a competing relay connection.
    expect(relay.connectCalls).toBe(0);
    expect(paths.at(-1)).toBe(null);
  });

  it('does not accumulate drop watchers across reconnect cycles', async () => {
    await service.connect(OPTIONS, KEY);
    await service.disconnect();
    await service.connect(OPTIONS, KEY);

    webrtc.state$.next(TransportState.Disconnected);
    await tick();

    // Exactly one failover, driven by the single live watcher.
    expect(relay.connectCalls).toBe(1);
  });

  it('falls back to relay when webrtc is unsupported', async () => {
    webrtc.supported = false;

    await service.connect(OPTIONS, KEY);

    expect(webrtc.connectCalls).toBe(0);
    expect(relay.connectCalls).toBe(1);
    expect(paths.at(-1)).toBe('relay');
  });
});
