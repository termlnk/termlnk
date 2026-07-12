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

import { SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE, SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE } from './constants';

/**
 * Every user-facing error code the shared-terminal domain can raise. UI layers
 * key localized messages off this union, so adding a code here forces the
 * compiler to surface every mapping that needs a new entry.
 */
export type SharedTerminalErrorCode =
  | typeof SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE
  | typeof SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE;

const SHARED_TERMINAL_ERROR_CODES: readonly SharedTerminalErrorCode[] = [
  SHARED_TERMINAL_INVITE_NOT_ACTIVE_ERROR_CODE,
  SHARED_TERMINAL_ANONYMOUS_JOIN_UNAVAILABLE_ERROR_CODE,
];

/**
 * Coded domain error for the shared-terminal feature.
 *
 * The message IS the code: on desktop these errors cross the tRPC/IPC boundary
 * (main-process RemoteSessionService → renderer facade) where only the message
 * survives serialization, so the code must ride the message to reach the UI.
 * Same-process consumers get the typed `code` field and the preserved `cause`.
 * Recover the code with `getSharedTerminalErrorCode` — never match messages
 * by hand.
 */
export class SharedTerminalError extends Error {
  override readonly name = 'SharedTerminalError';

  constructor(readonly code: SharedTerminalErrorCode, options?: ErrorOptions) {
    super(code, options);
  }
}

/**
 * The single place that knows how shared-terminal error codes travel.
 * Same-process errors are matched structurally; errors that crossed an RPC
 * boundary (and got re-wrapped) are matched by scanning the surviving message
 * for a registered code. Codes are namespaced (`shared-terminal.<kebab>`) so a
 * substring hit is unambiguous.
 */
export function getSharedTerminalErrorCode(err: unknown): SharedTerminalErrorCode | null {
  if (err instanceof SharedTerminalError) {
    return err.code;
  }
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!message) {
    return null;
  }
  return SHARED_TERMINAL_ERROR_CODES.find((code) => message.includes(code)) ?? null;
}
