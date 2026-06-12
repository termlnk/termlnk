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

import type { Duplex } from 'node:stream';
import { PassThrough } from 'node:stream';

export interface ITrafficSnapshot {
  bytesIn: number;
  bytesOut: number;
  bytesInRate: number;
  bytesOutRate: number;
}

// EMA-smoothed throughput meter. The tunnel runner calls `snapshot(now)` on a
// 250ms tick — each tick reuses the accumulators since the previous tick to
// compute an instantaneous rate, then folds it into the running EMA so the
// rate curve never jitters on connection-burst arrivals.
export class TrafficMeter {
  // Inbound = bytes arriving at our local listener side from the user agent;
  // outbound = bytes leaving our local listener side toward the user agent.
  // The reasoning is end-user oriented: "I just downloaded N bytes" → bytesIn.
  // The TrafficMeter is symmetric: it inverts both ends consistently.
  private _bytesIn = 0;
  private _bytesOut = 0;
  private _sinceSampleIn = 0;
  private _sinceSampleOut = 0;
  private _bytesInRate = 0;
  private _bytesOutRate = 0;
  private _lastSampledAt: number;

  constructor(initialTime: number) {
    this._lastSampledAt = initialTime;
  }

  // Wraps a pair of streams with PassThroughs that count bytes flowing in each
  // direction. Returns the wrapped pair the caller should pipe through.
  //
  // Direction convention:
  //   local   → upstream  (write side):  bytesOut += chunk.length
  //   upstream → local    (read side):   bytesIn  += chunk.length
  attach(local: Duplex, upstream: Duplex): { localSide: Duplex; upstreamSide: Duplex } {
    const localToUpstream = new PassThrough();
    const upstreamToLocal = new PassThrough();
    localToUpstream.on('data', (chunk: Buffer) => {
      this._bytesOut += chunk.length;
      this._sinceSampleOut += chunk.length;
    });
    upstreamToLocal.on('data', (chunk: Buffer) => {
      this._bytesIn += chunk.length;
      this._sinceSampleIn += chunk.length;
    });
    // Compose: local.read → localToUpstream → upstream.write
    //          upstream.read → upstreamToLocal → local.write
    local.pipe(localToUpstream).pipe(upstream);
    upstream.pipe(upstreamToLocal).pipe(local);
    return { localSide: local, upstreamSide: upstream };
  }

  snapshot(now: number): ITrafficSnapshot {
    const dtSec = Math.max(0.001, (now - this._lastSampledAt) / 1000);
    const sampleInRate = this._sinceSampleIn / dtSec;
    const sampleOutRate = this._sinceSampleOut / dtSec;
    // EMA: 0.7 history + 0.3 sample — converges in ~3 samples to a step
    // change while smoothing single-tick spikes.
    this._bytesInRate = 0.7 * this._bytesInRate + 0.3 * sampleInRate;
    this._bytesOutRate = 0.7 * this._bytesOutRate + 0.3 * sampleOutRate;
    this._sinceSampleIn = 0;
    this._sinceSampleOut = 0;
    this._lastSampledAt = now;
    return {
      bytesIn: this._bytesIn,
      bytesOut: this._bytesOut,
      bytesInRate: this._bytesInRate,
      bytesOutRate: this._bytesOutRate,
    };
  }

  reset(now: number): void {
    this._bytesIn = 0;
    this._bytesOut = 0;
    this._sinceSampleIn = 0;
    this._sinceSampleOut = 0;
    this._bytesInRate = 0;
    this._bytesOutRate = 0;
    this._lastSampledAt = now;
  }
}
