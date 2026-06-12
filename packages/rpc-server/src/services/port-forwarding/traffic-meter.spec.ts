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

import { Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { TrafficMeter } from './traffic-meter';

// A readable that never emits anything (so the pipe established by attach
// stays open without ever feeding data back the other way).
function inertReadable(): Readable {
  return new Readable({
    read() {},
  });
}

// A writable sink that drains anything written to it instantly.
function inertWritable(): Writable {
  return new Writable({
    write(_chunk, _enc, cb) { cb(); },
  });
}

// Build a Duplex-like pair where local-write goes to a sink and local-read
// stays inert; the meter only inspects the PassThroughs it inserts internally.
function makeDuplex(): { duplex: Readable & Writable; emit: (chunk: Buffer) => void } {
  const readSide = inertReadable();
  const writeSink = inertWritable();
  const duplex = Object.assign(readSide as Readable & Writable, {
    write: writeSink.write.bind(writeSink),
    end: writeSink.end.bind(writeSink),
  });
  return {
    duplex,
    emit: (chunk) => readSide.push(chunk),
  };
}

describe('TrafficMeter', () => {
  it('starts with zero counters', () => {
    const meter = new TrafficMeter(0);
    const snap = meter.snapshot(1000);
    expect(snap).toEqual({
      bytesIn: 0,
      bytesOut: 0,
      bytesInRate: 0,
      bytesOutRate: 0,
    });
  });

  it('counts upstream-sourced bytes as bytesIn', async () => {
    const meter = new TrafficMeter(0);
    const local = makeDuplex();
    const upstream = makeDuplex();
    meter.attach(local.duplex as never, upstream.duplex as never);

    upstream.emit(Buffer.alloc(123));
    await new Promise<void>((r) => setImmediate(r));

    const snap = meter.snapshot(1000);
    expect(snap.bytesIn).toBe(123);
    expect(snap.bytesOut).toBe(0);
  });

  it('counts local-sourced bytes as bytesOut', async () => {
    const meter = new TrafficMeter(0);
    const local = makeDuplex();
    const upstream = makeDuplex();
    meter.attach(local.duplex as never, upstream.duplex as never);

    local.emit(Buffer.alloc(77));
    await new Promise<void>((r) => setImmediate(r));

    const snap = meter.snapshot(1000);
    expect(snap.bytesOut).toBe(77);
    expect(snap.bytesIn).toBe(0);
  });

  it('EMA-smooths the bytesInRate across snapshots', async () => {
    const meter = new TrafficMeter(0);
    const local = makeDuplex();
    const upstream = makeDuplex();
    meter.attach(local.duplex as never, upstream.duplex as never);

    upstream.emit(Buffer.alloc(10240));
    await new Promise<void>((r) => setImmediate(r));
    const first = meter.snapshot(1000);
    // Sample rate over 1s = 10240; EMA = 0.7 * 0 + 0.3 * 10240 = 3072
    expect(first.bytesInRate).toBeCloseTo(3072, 0);

    const second = meter.snapshot(2000);
    // No new data over 1s; EMA = 0.7 * 3072 + 0.3 * 0 ≈ 2150.4
    expect(second.bytesInRate).toBeCloseTo(0.7 * 3072, 0);
  });

  it('reset() zeroes everything', () => {
    const meter = new TrafficMeter(0);
    meter.snapshot(1000);
    meter.reset(2000);
    const snap = meter.snapshot(3000);
    expect(snap.bytesIn).toBe(0);
    expect(snap.bytesOut).toBe(0);
    expect(snap.bytesInRate).toBe(0);
  });
});
