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

import type { IIdleProbe } from '@termlnk/auth';
import { powerMonitor } from 'electron';

/**
 * Electron implementation — wires `IIdleProbe` to
 * `powerMonitor.getSystemIdleTime()`.
 *
 * `getSystemIdleTime` returns the seconds since the last **system-level**
 * input (mouse / keyboard / touch) on macOS, Windows and Linux. That is
 * more accurate than app-level focus detection — a user who switched away
 * to write a document is not falsely treated as idle.
 *
 * The call is a cheap syscall on all three platforms.
 */
export class ElectronIdleProbe implements IIdleProbe {
  getIdleSeconds(): number {
    return powerMonitor.getSystemIdleTime();
  }
}
