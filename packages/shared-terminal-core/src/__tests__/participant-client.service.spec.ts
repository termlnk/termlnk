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
import { ConfigService } from '@termlnk/core';
import { firstValueFrom, toArray } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { FrameCodecService } from '../services/frame-codec.service';
import { ParticipantClientService } from '../services/participant-client.service';

class FakeLogService implements ILogService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  log = vi.fn();
  deprecate = vi.fn();
  setLogLevel = vi.fn();
}

function makeService(): ParticipantClientService {
  const crypto = new SharedTerminalCryptoService();
  const codec = new FrameCodecService(crypto);
  const log = new FakeLogService();
  const config = new ConfigService();
  return new ParticipantClientService(log, config, crypto, codec);
}

describe('ParticipantClientService (multi-session contract)', () => {
  it('starts with empty sessions list', () => {
    const svc = makeService();
    expect(svc.getSessions()).toEqual([]);
    svc.dispose();
  });

  it('sessions$ emits the empty array as its current value', async () => {
    const svc = makeService();
    const value = await firstValueFrom(svc.sessions$);
    expect(value).toEqual([]);
    svc.dispose();
  });

  it('state$/frames$/snapshot$/lastError$/connectionId$/metadata$ return an empty observable for unknown sessionIds', async () => {
    const svc = makeService();
    // toArray over an Observable that never emits would hang; EMPTY completes
    // immediately so toArray resolves to []. We rely on that to detect that
    // the lookup returned EMPTY rather than a still-open subject.
    expect(await firstValueFrom(svc.state$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.frames$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.snapshot$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.lastError$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.connectionId$('unknown').pipe(toArray()))).toEqual([]);
    expect(await firstValueFrom(svc.metadata$('unknown').pipe(toArray()))).toEqual([]);
    svc.dispose();
  });

  it('sendInput/sendControl on unknown sessionIds is a silent no-op', async () => {
    const svc = makeService();
    await expect(svc.sendInput('unknown', new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
    await expect(svc.sendControl('unknown', { type: 'heartbeat' })).resolves.toBeUndefined();
    svc.dispose();
  });

  it('disconnect on unknown sessionIds is a silent no-op', async () => {
    const svc = makeService();
    await expect(svc.disconnect('unknown')).resolves.toBeUndefined();
    svc.dispose();
  });
});
