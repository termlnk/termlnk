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
import type { IFrame, IOutboundFrame, IPtySource, IRecordingHandle } from '@termlnk/shared-terminal';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FrameChannel, FrameFlag, SharedSessionState, SharedTerminalRole } from '@termlnk/shared-terminal';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { PtyMultiplexerService } from '../services/pty-multiplexer.service';
import { SharedSessionRecordingService } from '../services/recording.service';

class FakeLogService implements ILogService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  log = vi.fn();
  deprecate = vi.fn();
  setLogLevel = vi.fn();
}

interface ITestSource {
  output$: Subject<Uint8Array>;
  writes: Uint8Array[];
  resizes: { cols: number; rows: number }[];
  source: IPtySource;
}

function createSource(id: string, opts: { cols?: number; rows?: number } = {}): ITestSource {
  const output$ = new Subject<Uint8Array>();
  const writes: Uint8Array[] = [];
  const resizes: { cols: number; rows: number }[] = [];
  const source: IPtySource = {
    id,
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    title: `test-${id}`,
    output$: output$.asObservable(),
    write: (data) => { writes.push(data); },
    resize: (cols, rows) => { resizes.push({ cols, rows }); },
  };
  return { output$, writes, resizes, source };
}

function controlFrame(payload: object, seq = 0): IFrame {
  return {
    channel: FrameChannel.Control,
    flags: FrameFlag.None,
    seq,
    payload: new TextEncoder().encode(JSON.stringify(payload)),
  };
}

function ptyDataFrame(bytes: Uint8Array, seq = 0): IFrame {
  return { channel: FrameChannel.PtyData, flags: FrameFlag.None, seq, payload: bytes };
}

async function waitFor<T>(probe: () => T | Promise<T | undefined> | undefined, timeoutMs = 1000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await probe();
    if (value !== undefined) {
      return value;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('[waitFor] condition not met within timeout');
}

describe('PtyMultiplexerService', () => {
  let mux: PtyMultiplexerService;
  let outbound: IOutboundFrame[];

  beforeEach(() => {
    mux = new PtyMultiplexerService(new FakeLogService(), new SharedTerminalCryptoService());
    outbound = [];
    mux.outbound$.subscribe((f) => outbound.push(f));
  });

  afterEach(() => {
    mux.dispose();
  });

  it('register makes session visible in sessions$', () => {
    const { source } = createSource('s1');
    mux.register(source);
    let last: readonly { id: string }[] = [];
    mux.sessions$.subscribe((v) => {
      last = v;
    });
    expect(last).toHaveLength(1);
    expect(last[0]!.id).toBe('s1');
  });

  it('register twice with same sessionId throws', () => {
    const { source } = createSource('s1');
    mux.register(source);
    expect(() => mux.register(source)).toThrow(/already registered/);
  });

  it('PTY output is broadcast as PtyData frame', () => {
    const { source, output$ } = createSource('s1');
    mux.register(source);
    mux.attachClient('s1', 'clientA', SharedTerminalRole.CoPilot);
    outbound = [];

    const data = new Uint8Array([0x68, 0x69]); // "hi"
    output$.next(data);

    const ptyFrames = outbound.filter((f) => f.frame.channel === FrameChannel.PtyData);
    expect(ptyFrames).toHaveLength(1);
    expect(ptyFrames[0]!.target).toBe('broadcast');
    expect(ptyFrames[0]!.frame.payload).toEqual(data);
  });

  it('PTY output without attached clients still tracked by headless terminal', async () => {
    const { source, output$ } = createSource('s1');
    mux.register(source);
    output$.next(new TextEncoder().encode('hello '));
    output$.next(new TextEncoder().encode('world'));

    // attach later — snapshot should contain the printed text within the ANSI replay sequence
    mux.attachClient('s1', 'clientA', SharedTerminalRole.CoPilot);
    const snap = await mux.snapshot('s1');
    expect(snap.serialized).toContain('hello world');
  });

  it('attachClient sends snapshot frame to that client only', async () => {
    const { source, output$ } = createSource('s1');
    mux.register(source);
    output$.next(new TextEncoder().encode('greeting'));
    outbound = [];

    mux.attachClient('s1', 'clientA', SharedTerminalRole.CoPilot, 'Alice');

    // The snapshot is dispatched asynchronously (headless serialize must wait
    // for write flush). Wait up to 1s for a SessionEvent frame targeted at clientA.
    const snapshotFrame = await waitFor(() => outbound.find(
      (f) => f.target === 'clientA' && f.frame.channel === FrameChannel.SessionEvent
    ));
    const snap = JSON.parse(new TextDecoder().decode(snapshotFrame.frame.payload));
    expect(snap.type).toBe('snapshot');
    expect(snap.sessionId).toBe('s1');
    expect(snap.serialized).toContain('greeting');
  });

  it('only driver clientId can write stdin to PTY; others are ignored', () => {
    const { source } = createSource('s1');
    const ts = createSource('s1');
    Object.assign(source, ts.source);
    mux.register(ts.source);
    mux.attachClient('s1', 'driver', SharedTerminalRole.CoPilot);
    mux.attachClient('s1', 'observer', SharedTerminalRole.Observer);
    mux.attachClient('s1', 'other', SharedTerminalRole.CoPilot);
    mux.setDriver('s1', 'driver');

    mux.handleInbound('s1', 'driver', ptyDataFrame(new Uint8Array([1])));
    mux.handleInbound('s1', 'observer', ptyDataFrame(new Uint8Array([2])));
    mux.handleInbound('s1', 'other', ptyDataFrame(new Uint8Array([3])));

    expect(ts.writes).toHaveLength(1);
    expect(ts.writes[0]).toEqual(new Uint8Array([1]));
  });

  it('non-writer roles cannot become driver', () => {
    const { source } = createSource('s1');
    mux.register(source);
    mux.attachClient('s1', 'observer', SharedTerminalRole.Observer);
    expect(() => mux.setDriver('s1', 'observer')).toThrow(/not allowed to be driver/);
  });

  it('driver_request control frame transfers driver role', () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    mux.attachClient('s1', 'b', SharedTerminalRole.CoPilot);
    mux.setDriver('s1', 'a');
    outbound = [];

    mux.handleInbound('s1', 'b', controlFrame({ type: 'driver_request' }));

    let drv: { driverId: string | null } = { driverId: null };
    mux.driverState$('s1').subscribe((s) => {
      drv = s;
    });
    expect(drv.driverId).toBe('b');

    const handover = outbound.find((f) => f.frame.channel === FrameChannel.SessionEvent);
    const event = JSON.parse(new TextDecoder().decode(handover!.frame.payload));
    expect(event.type).toBe('driver_handover');
    expect(event.fromClientId).toBe('a');
    expect(event.toClientId).toBe('b');
  });

  it('driver lock prevents takeover', () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    mux.attachClient('s1', 'b', SharedTerminalRole.CoPilot);
    mux.setDriver('s1', 'a');
    mux.lockDriver('s1', 'a');

    mux.handleInbound('s1', 'b', controlFrame({ type: 'driver_request' }));

    let drv: { driverId: string | null } = { driverId: null };
    mux.driverState$('s1').subscribe((s) => {
      drv = s;
    });
    expect(drv.driverId).toBe('a');
  });

  it('detachClient removes participant + clears driver if applicable', () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    mux.setDriver('s1', 'a');

    mux.detachClient('s1', 'a');

    let drv: { driverId: string | null } = { driverId: 'x' };
    mux.driverState$('s1').subscribe((s) => {
      drv = s;
    });
    expect(drv.driverId).toBeNull();

    let participants: readonly { connectionId: string }[] = [];
    mux.participants$('s1').subscribe((p) => {
      participants = p;
    });
    expect(participants).toHaveLength(0);
  });

  it('resize from driver propagates to PTY source', () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    mux.setDriver('s1', 'a');

    mux.handleInbound('s1', 'a', controlFrame({ type: 'resize', cols: 100, rows: 30 }));
    expect(ts.resizes).toEqual([{ cols: 100, rows: 30 }]);
  });

  it('resize from driver also updates headless session size in snapshot', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    mux.setDriver('s1', 'a');

    mux.handleInbound('s1', 'a', controlFrame({ type: 'resize', cols: 120, rows: 40 }));

    const snap = await mux.snapshot('s1');
    expect(snap.cols).toBe(120);
    expect(snap.rows).toBe(40);

    let last: readonly { cols: number; rows: number }[] = [];
    mux.sessions$.subscribe((v) => {
      last = v;
    });
    expect(last[0]!.cols).toBe(120);
    expect(last[0]!.rows).toBe(40);
  });

  it('resize from non-driver is ignored', () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    mux.attachClient('s1', 'b', SharedTerminalRole.CoPilot);
    mux.setDriver('s1', 'a');

    mux.handleInbound('s1', 'b', controlFrame({ type: 'resize', cols: 100, rows: 30 }));
    expect(ts.resizes).toEqual([]);
  });

  it('kick sends control to victim then detaches', () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    outbound = [];

    mux.kick('s1', 'a', 'naughty');

    const kickFrame = outbound.find(
      (f) => f.target === 'a' && f.frame.channel === FrameChannel.Control
    );
    expect(kickFrame).toBeDefined();
    const msg = JSON.parse(new TextDecoder().decode(kickFrame!.frame.payload));
    expect(msg.type).toBe('kick');
    expect(msg.reason).toBe('naughty');

    let participants: readonly { connectionId: string }[] = [];
    mux.participants$('s1').subscribe((p) => {
      participants = p;
    });
    expect(participants).toHaveLength(0);
  });

  it('frames have monotonically increasing seq per channel', () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    outbound = [];

    ts.output$.next(new Uint8Array([1]));
    ts.output$.next(new Uint8Array([2]));
    ts.output$.next(new Uint8Array([3]));

    const ptyFrames = outbound.filter((f) => f.frame.channel === FrameChannel.PtyData);
    expect(ptyFrames.map((f) => f.frame.seq)).toEqual([0, 1, 2]);
  });

  it('unregister via IRegisteredPty.unregister broadcasts session_closed', () => {
    const ts = createSource('s1');
    const handle = mux.register(ts.source);
    mux.attachClient('s1', 'a', SharedTerminalRole.CoPilot);
    outbound = [];

    handle.unregister();

    const closed = outbound.find((f) => f.frame.channel === FrameChannel.SessionEvent);
    const event = JSON.parse(new TextDecoder().decode(closed!.frame.payload));
    expect(event.type).toBe('session_closed');

    let sessions: readonly { id: string }[] = [];
    mux.sessions$.subscribe((s) => {
      sessions = s;
    });
    expect(sessions).toHaveLength(0);
  });
});

describe('PtyMultiplexerService recording integration', () => {
  let dir: string;
  let now = 1_000_000;
  let recording: SharedSessionRecordingService;
  let mux: PtyMultiplexerService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'termlnk-mux-recording-'));
    recording = new SharedSessionRecordingService({
      recordingsDir: dir,
      now: () => now,
    });
    mux = new PtyMultiplexerService(new FakeLogService(), new SharedTerminalCryptoService(), null, recording);
  });

  afterEach(async () => {
    mux.dispose();
    recording.dispose();
    await rm(dir, { recursive: true, force: true });
  });

  it('records PTY output even when no clients are attached', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const handle = await recording.start({ sessionId: 's1', title: 'recorded', mandatory: false });
    now += 1200;

    ts.output$.next(new TextEncoder().encode('boot log'));
    await waitFor(async () => {
      const cast = await readFile(handle.path, 'utf-8');
      return cast.includes('boot log') ? cast : undefined;
    });

    let sessions: readonly { recording: boolean; state: SharedSessionState }[] = [];
    mux.sessions$.subscribe((value) => {
      sessions = value;
    });
    expect(sessions[0]!.recording).toBe(true);
    expect(sessions[0]!.state).toBe(SharedSessionState.Recording);
  });

  it('writes participant and session close audit events to active recording', async () => {
    const ts = createSource('s1');
    const registered = mux.register(ts.source);
    const handle = await recording.start({ sessionId: 's1', title: 'audit', mandatory: false });

    mux.attachClient('s1', 'clientA', SharedTerminalRole.CoPilot, 'Alice');
    registered.unregister();

    const auditLogPath = handle.path.replace(/\.cast$/, '.audit.jsonl');
    const audit = await waitFor(async () => {
      const text = await readFile(auditLogPath, 'utf-8');
      return text.includes('participant_joined') && text.includes('session_closed') ? text : undefined;
    });
    expect(audit).toContain('clientA');
    expect(audit).toContain('session_closed');
  });

  it('starts mandatory recording before auditor participant is joined', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);

    mux.attachClient('s1', 'auditorA', SharedTerminalRole.Auditor, 'Auditor');

    const active = await waitFor(() => {
      let handles: readonly IRecordingHandle[] = [];
      recording.activeRecordings$.subscribe((value) => {
        handles = value;
      }).unsubscribe();
      return handles[0];
    });
    expect(active.sessionId).toBe('s1');
    expect(active.mandatory).toBe(true);

    const participant = await waitFor(() => {
      let participants: readonly { connectionId: string; role: SharedTerminalRole }[] = [];
      mux.participants$('s1').subscribe((value) => {
        participants = value;
      }).unsubscribe();
      return participants.find((item) => item.connectionId === 'auditorA');
    });
    expect(participant.role).toBe(SharedTerminalRole.Auditor);

    const list = await recording.list();
    await expect(recording.stop(active)).rejects.toThrow(/mandatory/);
    expect(list[0]!.endedAt).toBeNull();
  });

  it('records a participant_kicked audit event distinct from a voluntary leave', async () => {
    const ts = createSource('s1');
    mux.register(ts.source);
    const handle = await recording.start({ sessionId: 's1', title: 'kick-test', mandatory: false });
    mux.attachClient('s1', 'clientA', SharedTerminalRole.CoPilot, 'Alice');
    mux.kick('s1', 'clientA', 'policy violation');

    const auditLogPath = handle.path.replace(/\.cast$/, '.audit.jsonl');
    const audit = await waitFor(async () => {
      const text = await readFile(auditLogPath, 'utf-8');
      return text.includes('participant_kicked') ? text : undefined;
    });
    expect(audit).toContain('participant_kicked');
    expect(audit).toContain('policy violation');
    // Followed by the implicit participant_left.
    expect(audit).toContain('participant_left');
  });
});
