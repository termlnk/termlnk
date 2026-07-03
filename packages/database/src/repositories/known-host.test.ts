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

import type { IKnownHostEntity } from '../entities';
import { describe, expect, it } from 'vitest';
import { classifyKnownHost, makeKnownHostId } from './known-host';

function row(partial: Partial<IKnownHostEntity>): IKnownHostEntity {
  return {
    id: 'id',
    host: 'example.com',
    port: 22,
    keyType: 'ssh-ed25519',
    fingerprint: 'SHA256:abc',
    publicKey: null,
    lastSeenAt: null,
    accessedAt: '',
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('classifyKnownHost', () => {
  it('returns unknown on first contact (no candidates)', () => {
    expect(classifyKnownHost([], 'ssh-ed25519', 'SHA256:abc').verdict).toBe('unknown');
  });

  it('returns trusted when a candidate fingerprint matches', () => {
    const candidates = [row({ fingerprint: 'SHA256:abc' })];
    expect(classifyKnownHost(candidates, 'ssh-ed25519', 'SHA256:abc').verdict).toBe('trusted');
  });

  it('returns changed when the same key type has a different fingerprint', () => {
    const candidates = [row({ keyType: 'ssh-ed25519', fingerprint: 'SHA256:old' })];
    const match = classifyKnownHost(candidates, 'ssh-ed25519', 'SHA256:new');
    expect(match.verdict).toBe('changed');
    expect(match.existing?.fingerprint).toBe('SHA256:old');
  });

  it('returns unknown when only a different key type is stored', () => {
    const candidates = [row({ keyType: 'ssh-rsa', fingerprint: 'SHA256:rsa' })];
    expect(classifyKnownHost(candidates, 'ssh-ed25519', 'SHA256:ed').verdict).toBe('unknown');
  });
});

describe('makeKnownHostId', () => {
  it('is deterministic for the same (host, port, keyType)', () => {
    expect(makeKnownHostId('example.com', 22, 'ssh-ed25519'))
      .toBe(makeKnownHostId('example.com', 22, 'ssh-ed25519'));
  });

  it('differs for different hosts', () => {
    expect(makeKnownHostId('a.example.com', 22, 'ssh-ed25519'))
      .not
      .toBe(makeKnownHostId('b.example.com', 22, 'ssh-ed25519'));
  });

  it('differs for different ports', () => {
    expect(makeKnownHostId('example.com', 22, 'ssh-ed25519'))
      .not
      .toBe(makeKnownHostId('example.com', 2222, 'ssh-ed25519'));
  });

  it('differs for different key types', () => {
    expect(makeKnownHostId('example.com', 22, 'ssh-ed25519'))
      .not
      .toBe(makeKnownHostId('example.com', 22, 'ssh-rsa'));
  });

  it('produces an opaque kh_ prefix (does not leak host plaintext)', () => {
    const id = makeKnownHostId('example.com', 22, 'ssh-ed25519');
    expect(id).toMatch(/^kh_[0-9a-f]{24}$/);
    expect(id).not.toContain('example.com');
  });
});
