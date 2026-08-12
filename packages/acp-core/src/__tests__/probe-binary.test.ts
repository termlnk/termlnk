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

import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isOnDemandLauncher,
  probeProviderAvailability,
  resolveBinaryOnPath,
} from '../services/discovery/probe-binary';

const scratchDirs: string[] = [];

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeScratchBin(name: string): { dir: string; path: string } {
  const dir = join(tmpdir(), `acp-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  scratchDirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, '#!/bin/sh\necho "1.2.3"\n', { mode: 0o755 });
  chmodSync(path, 0o755);
  return { dir, path };
}

describe('probe-binary', () => {
  it('detects on-demand launchers', () => {
    expect(isOnDemandLauncher('npx')).toBe(true);
    expect(isOnDemandLauncher('bunx')).toBe(true);
    expect(isOnDemandLauncher('claude')).toBe(false);
  });

  it('resolves a binary on PATH', () => {
    const { dir, path } = makeScratchBin('fake-agent');
    const resolved = resolveBinaryOnPath('fake-agent', { PATH: dir });
    expect(resolved).toBe(path);
  });

  it('returns missing when binary is absent', async () => {
    const result = await probeProviderAvailability(
      ['definitely-not-installed-xyz'],
      { PATH: '/nonexistent' }
    );
    expect(result).toEqual({ state: 'missing' });
  });

  it('returns installed with version when --version works', async () => {
    const { dir, path } = makeScratchBin('ver-agent');
    const result = await probeProviderAvailability(['ver-agent'], { PATH: dir });
    expect(result.state).toBe('installed');
    if (result.state === 'installed') {
      expect(result.resolvedPath).toBe(path);
      expect(result.version).toContain('1.2.3');
    }
  });

  it('marks npx as on-demand when launcher exists', async () => {
    const { dir } = makeScratchBin('npx');
    const result = await probeProviderAvailability(['npx', 'some-pkg'], { PATH: dir });
    expect(result).toEqual({ state: 'on-demand' });
  });
});
