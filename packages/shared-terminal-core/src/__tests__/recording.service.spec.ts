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

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SharedSessionRecordingService } from '../services/recording.service';

describe('SharedSessionRecordingService', () => {
  let dir: string;
  let now = 1_000_000;
  let service: SharedSessionRecordingService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'termlnk-recording-'));
    service = new SharedSessionRecordingService({
      recordingsDir: dir,
      now: () => now,
    });
  });

  afterEach(async () => {
    service.dispose();
    await rm(dir, { recursive: true, force: true });
  });

  it('writes asciicast header, output events and metadata', async () => {
    const handle = await service.start({ sessionId: 's1', title: 'host-1', mandatory: false });
    now += 2500;
    await service.appendOutput(handle, new TextEncoder().encode('hello'));
    await service.stop(handle);

    const cast = await readFile(handle.path, 'utf-8');
    const lines = cast.trim().split('\n');
    expect(JSON.parse(lines[0]!).version).toBe(2);
    expect(JSON.parse(lines[1]!)).toEqual([2.5, 'o', 'hello']);

    const list = await service.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.endedAt).toBe(now);
    expect(list[0]!.bytes).toBeGreaterThan(0);
  });

  it('returns existing active handle for duplicate session start', async () => {
    const a = await service.start({ sessionId: 's1', title: 'first', mandatory: false });
    const b = await service.start({ sessionId: 's1', title: 'second', mandatory: false });

    expect(b.id).toBe(a.id);
  });

  it('upgrades an active recording to mandatory', async () => {
    const handle = await service.start({ sessionId: 's1', title: 'first', mandatory: false });
    const upgraded = await service.start({ sessionId: 's1', title: 'audit', mandatory: true });

    expect(upgraded.id).toBe(handle.id);
    expect(upgraded.mandatory).toBe(true);
    await expect(service.stop(upgraded)).rejects.toThrow(/mandatory/);
  });

  it('requires force to stop mandatory recordings', async () => {
    const handle = await service.start({ sessionId: 's1', title: 'audit', mandatory: true });

    await expect(service.stop(handle)).rejects.toThrow(/mandatory/);
    await service.stop(handle, true);

    expect(await service.list()).toHaveLength(1);
  });

  it('deletes cast and audit sidecar', async () => {
    const handle = await service.start({ sessionId: 's1', title: 'host-1', mandatory: false });
    await service.stop(handle);

    expect(await service.delete(handle.id)).toBe(true);
    expect(await service.list()).toHaveLength(0);
  });
});
