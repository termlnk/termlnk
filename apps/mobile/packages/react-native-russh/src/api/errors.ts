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

import type { IRusshError, RusshErrorKind } from './types';
import * as GeneratedRussh from '../index';

export class RusshError extends Error implements IRusshError {
  readonly kind: RusshErrorKind;

  constructor(
    kind: RusshErrorKind,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'RusshError';
    this.kind = kind;
  }
}

// Pull the tuple payload off a uniffi tuple-style variant without leaking
// the generated types outside this module.
function innerString(err: unknown): string | undefined {
  const inner = (err as { inner?: readonly unknown[] }).inner;
  if (!Array.isArray(inner)) {
    return undefined;
  }
  const first = inner[0];
  return typeof first === 'string' ? first : undefined;
}

function fromUniffiSshError(err: unknown): RusshError | null {
  // The generated `instanceOf` helpers read `err.tag` without guarding — a
  // throw on a non-object would mask the real error in our catch chain.
  if (err === null || typeof err !== 'object') {
    return null;
  }
  const { SshError } = GeneratedRussh;

  if (SshError.Disconnected.instanceOf(err)) {
    return new RusshError('connectionReset', 'Disconnected', { cause: err });
  }
  if (SshError.UnsupportedKeyType.instanceOf(err)) {
    return new RusshError('invalidKey', 'Unsupported key type', { cause: err });
  }
  if (SshError.Auth.instanceOf(err)) {
    const inner = innerString(err);
    return new RusshError('authFailed', inner ?? 'Authentication failed', {
      cause: err,
    });
  }
  if (SshError.ShellAlreadyRunning.instanceOf(err)) {
    return new RusshError('protocol', 'Shell already running', { cause: err });
  }
  if (SshError.RusshKeys.instanceOf(err)) {
    const inner = innerString(err);
    return new RusshError('invalidKey', inner ?? 'Key parsing error', {
      cause: err,
    });
  }
  if (SshError.Russh.instanceOf(err)) {
    // The Rust side flattens every `russh::Error` and `std::io::Error` into
    // this catch-all string. Heuristic classification on a free-form debug
    // payload is brittle, so we keep `kind: 'unknown'` and preserve the full
    // text — splitting the catch-all into typed variants belongs on the Rust
    // side (TODO in rust/uniffi-russh/src/utils.rs).
    const inner = innerString(err);
    return new RusshError('unknown', inner ?? 'SSH error', { cause: err });
  }
  return null;
}

export function normalizeError(err: unknown): unknown {
  if (err instanceof RusshError) {
    return err;
  }
  const mapped = fromUniffiSshError(err);
  return mapped ?? err;
}

// Same as `normalizeError` but guarantees a `RusshError` return. Use this at
// boundaries that need a typed error in their return signature (e.g.
// `validatePrivateKey`'s result discriminator).
export function toRusshError(err: unknown): RusshError {
  if (err instanceof RusshError) {
    return err;
  }
  const mapped = fromUniffiSshError(err);
  if (mapped) {
    return mapped;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new RusshError('unknown', message, { cause: err });
}

export async function callRusshAsync<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw normalizeError(e);
  }
}

export function callRusshSync<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    throw normalizeError(e);
  }
}
