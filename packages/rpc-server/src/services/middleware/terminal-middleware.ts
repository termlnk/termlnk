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

import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';

export type TerminalMiddlewareState = 'idle' | 'active';

export interface ITerminalMiddleware extends IDisposable {
  readonly name: string;
  readonly state: TerminalMiddlewareState;
  readonly state$: Observable<TerminalMiddlewareState>;

  /**
   * Process data coming from the SSH channel (server → terminal).
   * Return the (possibly modified) data to pass downstream, or `null` to consume it entirely.
   */
  feedFromSession(data: Uint8Array): Uint8Array | null;

  /**
   * Process data coming from the terminal (terminal → server).
   * Return the (possibly modified) data to pass downstream, or `null` to consume it entirely.
   */
  feedFromTerminal(data: Uint8Array): Uint8Array | null;
}
