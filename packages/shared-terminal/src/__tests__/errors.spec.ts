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

import { describe, expect, it } from 'vitest';
import { SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE, SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE } from '../common/constants';
import { getSharedTerminalErrorCode, SharedTerminalError } from '../common/errors';

describe('SharedTerminalError', () => {
  it('exposes the code as both `.code` and `.message`, with the expected name', () => {
    const err = new SharedTerminalError(SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE);

    expect(err.code).toBe(SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE);
    expect(err.message).toBe(SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE);
    expect(err.name).toBe('SharedTerminalError');
  });

  it('preserves `cause` when passed', () => {
    const cause = new Error('underlying network failure');
    const err = new SharedTerminalError(SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE, { cause });

    expect(err.cause).toBe(cause);
  });
});

describe('getSharedTerminalErrorCode', () => {
  it('reads the code directly off a SharedTerminalError instance', () => {
    const err = new SharedTerminalError(SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE);

    expect(getSharedTerminalErrorCode(err)).toBe(SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE);
  });

  it('recovers the code from a plain Error whose message survived an RPC boundary re-wrap', () => {
    // Mirrors what a tRPC client actually hands back once a main-process
    // SharedTerminalError has crossed the IPC boundary and been re-wrapped.
    const err = new Error('TRPCClientError: wrapped: shared-terminal.invite-not-active (rest)');

    expect(getSharedTerminalErrorCode(err)).toBe(SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE);
  });

  it('returns null for a plain Error with an unrelated message', () => {
    expect(getSharedTerminalErrorCode(new Error('some other failure'))).toBeNull();
  });

  it('returns null for non-error, non-matching inputs', () => {
    expect(getSharedTerminalErrorCode(null)).toBeNull();
    expect(getSharedTerminalErrorCode(undefined)).toBeNull();
    expect(getSharedTerminalErrorCode(42)).toBeNull();
  });
});
