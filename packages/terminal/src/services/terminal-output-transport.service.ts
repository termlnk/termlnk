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
import type { TerminalOutputSourceType } from '../models/terminal-output';
import { createIdentifier } from '@termlnk/core';

export interface ITerminalOutputChunk {
  readonly data: Uint8Array;
  readonly sequence: number;
  acknowledge(): void;
}

export interface ITerminalOutputTransportService extends IDisposable {
  data$(source: TerminalOutputSourceType, sessionId: string): Observable<ITerminalOutputChunk>;
}

export const ITerminalOutputTransportService = createIdentifier<ITerminalOutputTransportService>('terminal.terminal-output-transport-service');
