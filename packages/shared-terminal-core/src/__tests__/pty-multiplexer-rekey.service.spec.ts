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

import type { ILogService, LogLevel } from '@termlnk/core';
import type { IDaemonKeypairService, IKeypair, IOutboundFrame, IPtySource } from '@termlnk/shared-terminal';
import { FrameChannel, SharedTerminalRole } from '@termlnk/shared-terminal';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { DriverArbitrationService } from '../services/driver-arbitration.service';
import { PtyMultiplexerService } from '../services/pty-multiplexer.service';
import { SessionKeyService } from '../services/session-key.service';
import { base64UrlToBytes } from '../utils/encoding';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeDaemonKeypair implements IDaemonKeypairService {
  constructor(private readonly _kp: IKeypair) {}
  async getOrCreate(): Promise<IKeypair> {
    return this._kp;
  }

  async getPublicKey(): Promise<Uint8Array> {
    return this._kp.publicKey;
  }

  async rotate(): Promise<IKeypair> {
    return this._kp;
  }
}

function createSource(id: string): { source: IPtySource; output$: Subject<Uint8Array>; write: ReturnType<typeof vi.fn> } {
  const output$ = new Subject<Uint8Array>();
  const resize$ = new Subject<{ cols: number; rows: number }>();
  const write = vi.fn();
  return {
    source: {
      id,
      cols: 80,
      rows: 24,
      title: id,
      output$,
      resize$,
      write,
      resize: vi.fn(),
    },
    output$,
    write,
  };
}

async function collectControlMessages(
  mux: PtyMultiplexerService,
  ms: number
): Promise<IOutboundFrame[]> {
  const captured: IOutboundFrame[] = [];
  const sub = mux.outbound$.subscribe((frame) => {
    if (frame.frame.channel === FrameChannel.Control) {
      captured.push(frame);
    }
  });
  await new Promise((resolve) => setTimeout(resolve, ms));
  sub.unsubscribe();
  return captured;
}

describe('PtyMultiplexer rekey', () => {
  let crypto: SharedTerminalCryptoService;
  let daemonKp: IKeypair;
  let daemonService: FakeDaemonKeypair;
  let mux: PtyMultiplexerService;
  let driver: DriverArbitrationService;
  let keyService: SessionKeyService;

  beforeEach(() => {
    crypto = new SharedTerminalCryptoService();
    daemonKp = crypto.generateKeypair();
    daemonService = new FakeDaemonKeypair(daemonKp);
    const log = new NoopLogService();
    driver = new DriverArbitrationService(log);
    keyService = new SessionKeyService(crypto, log, daemonService);
    mux = new PtyMultiplexerService(driver, keyService, log);
  });

  afterEach(() => {
    mux.dispose();
    keyService.dispose();
    driver.dispose();
  });

  it('generates a session key when the first keyed client attaches', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const recipientKp = crypto.generateKeypair();

    expect(mux.getSessionKey('s1')).toBeNull();
    mux.attachClient('s1', 'c1', SharedTerminalRole.CoPilot, 'cop', recipientKp.publicKey);

    // Wait for the async wrap-and-broadcast scheduled by attach.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const sessionKey = mux.getSessionKey('s1');
    expect(sessionKey?.length).toBe(32);
  });

  it('broadcasts a rekey control frame the recipient can unwrap', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const recipientKp = crypto.generateKeypair();
    const captured: IOutboundFrame[] = [];
    const sub = mux.outbound$.subscribe((frame) => {
      if (frame.frame.channel === FrameChannel.Control) {
        captured.push(frame);
      }
    });

    mux.attachClient('s1', 'c1', SharedTerminalRole.CoPilot, 'cop', recipientKp.publicKey);
    await new Promise((resolve) => setTimeout(resolve, 10));
    sub.unsubscribe();

    const rekeyFrame = captured.find((f) => {
      const parsed = JSON.parse(new TextDecoder().decode(f.frame.payload)) as { type?: string };
      return parsed.type === 'rekey';
    });
    expect(rekeyFrame).toBeDefined();

    const body = JSON.parse(new TextDecoder().decode(rekeyFrame!.frame.payload)) as {
      type: string;
      wrappedKey: string;
      senderPublicKey: string;
      reason: string;
    };
    expect(body.type).toBe('rekey');
    expect(body.reason).toBe('manual');

    const wrapped = base64UrlToBytes(body.wrappedKey);
    const senderPub = base64UrlToBytes(body.senderPublicKey);
    expect(Array.from(senderPub)).toEqual(Array.from(daemonKp.publicKey));
    const unwrapped = crypto.unwrapSessionKey(wrapped, senderPub, recipientKp.secretKey);
    expect(Array.from(unwrapped)).toEqual(Array.from(mux.getSessionKey('s1')!));
  });

  it('rekey(manual) rotates the key and broadcasts to all keyed participants', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const cop = crypto.generateKeypair();
    const obs = crypto.generateKeypair();
    mux.attachClient('s1', 'c1', SharedTerminalRole.CoPilot, 'cop', cop.publicKey);
    mux.attachClient('s1', 'c2', SharedTerminalRole.Observer, 'obs', obs.publicKey);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const previous = mux.getSessionKey('s1');
    expect(previous).not.toBeNull();

    const captured = await Promise.all([
      collectControlMessages(mux, 20),
      mux.rekey('s1', 'manual'),
    ]);
    const result = captured[1];
    expect(result.recipientCount).toBe(2);
    expect(result.unwrappedClientIds).toEqual([]);

    const fresh = mux.getSessionKey('s1');
    expect(Array.from(fresh!)).not.toEqual(Array.from(previous!));
  });

  it('kick triggers a rekey for the remaining keyed participants', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const cop = crypto.generateKeypair();
    const obs = crypto.generateKeypair();
    mux.attachClient('s1', 'c1', SharedTerminalRole.CoPilot, 'cop', cop.publicKey);
    mux.attachClient('s1', 'c2', SharedTerminalRole.Observer, 'obs', obs.publicKey);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const before = mux.getSessionKey('s1');
    mux.kick('s1', 'c1', 'manual');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const after = mux.getSessionKey('s1');
    expect(after).not.toBeNull();
    expect(Array.from(after!)).not.toEqual(Array.from(before!));
  });

  it('drops the session key when the last keyed participant leaves', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const cop = crypto.generateKeypair();
    mux.attachClient('s1', 'c1', SharedTerminalRole.CoPilot, 'cop', cop.publicKey);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mux.getSessionKey('s1')).not.toBeNull();

    mux.detachClient('s1', 'c1');
    expect(mux.getSessionKey('s1')).toBeNull();
  });

  it('skips clients without a registered publicKey on rekey', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const cop = crypto.generateKeypair();
    mux.attachClient('s1', 'c1', SharedTerminalRole.CoPilot, 'cop', cop.publicKey);
    mux.attachClient('s1', 'c2-legacy', SharedTerminalRole.Observer, 'legacy');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await mux.rekey('s1', 'manual');
    expect(result.recipientCount).toBe(1);
    expect(result.unwrappedClientIds).toEqual(['c2-legacy']);
  });

  it('no rekey occurs when daemon keypair service is unavailable', async () => {
    const log = new NoopLogService();
    const driver2 = new DriverArbitrationService(log);
    const keyService2 = new SessionKeyService(crypto, log);
    const mux2 = new PtyMultiplexerService(driver2, keyService2, log);
    const ts = createSource('s1');
    mux2.register(ts.source);
    const cop = crypto.generateKeypair();
    mux2.attachClient('s1', 'c1', SharedTerminalRole.CoPilot, 'cop', cop.publicKey);
    await new Promise((resolve) => setTimeout(resolve, 10));
    // No daemon keypair → session key remains null.
    expect(mux2.getSessionKey('s1')).toBeNull();
    mux2.dispose();
    keyService2.dispose();
    driver2.dispose();
  });
});
