/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// Trust-on-first-use store for SSH server public keys. On the first
// connection to a host we record (algorithm, fingerprintSha256) under the
// hostId; subsequent connections compare and refuse the handshake when the
// fingerprint changes — the russh.onServerKey callback consumes the
// returned `accept` bool.

import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'russh-tofu:';

export interface IStoredServerKey {
  readonly algorithm: string;
  readonly fingerprintSha256: string;
  readonly firstSeenAtMs: number;
}

export type TofuDecision =
  | { kind: 'trusted' }
  | { kind: 'first-use'; saved: IStoredServerKey }
  | { kind: 'mismatch'; stored: IStoredServerKey; presented: { algorithm: string; fingerprintSha256: string } };

function key(hostId: string): string {
  // SecureStore keys are limited to [A-Za-z0-9._-]; hostId may contain
  // arbitrary characters from user-edited host trees, so we encode it.
  const encoded = hostId.replace(/[^A-Za-z0-9._-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
  return `${KEY_PREFIX}${encoded}`;
}

export async function loadStoredServerKey(hostId: string): Promise<IStoredServerKey | null> {
  const raw = await SecureStore.getItemAsync(key(hostId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as IStoredServerKey;
  } catch {
    return null;
  }
}

export async function recordServerKey(
  hostId: string,
  algorithm: string,
  fingerprintSha256: string,
): Promise<IStoredServerKey> {
  const entry: IStoredServerKey = {
    algorithm,
    fingerprintSha256,
    firstSeenAtMs: Date.now(),
  };
  await SecureStore.setItemAsync(key(hostId), JSON.stringify(entry));
  return entry;
}

export async function forgetServerKey(hostId: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(hostId));
}

export async function evaluateServerKey(
  hostId: string,
  algorithm: string,
  fingerprintSha256: string,
): Promise<TofuDecision> {
  const stored = await loadStoredServerKey(hostId);
  if (!stored) {
    const saved = await recordServerKey(hostId, algorithm, fingerprintSha256);
    return { kind: 'first-use', saved };
  }
  if (
    stored.algorithm === algorithm &&
    stored.fingerprintSha256 === fingerprintSha256
  ) {
    return { kind: 'trusted' };
  }
  return {
    kind: 'mismatch',
    stored,
    presented: { algorithm, fingerprintSha256 },
  };
}
