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

import { createIdentifier } from '@termlnk/core';

// Returns the number of seconds since the last user input, so IdleLockController can run
// without depending on Electron directly.
//
// Implementations:
// - @termlnk/auth-core         — NoopIdleProbe (always 0 = "never idle"; for tests / non-Electron).
// - @termlnk/electron-main     — wraps electron.powerMonitor.getSystemIdleTime().
//
// 0 means input just happened; N means N seconds without input.
//
// Implementations must not throw — fall back to 0 on platform errors so a probe failure
// cannot accidentally lock the user out.
export interface IIdleProbe {
  getIdleSeconds(): number;
}

export const IIdleProbe = createIdentifier<IIdleProbe>('auth.idle-probe');
