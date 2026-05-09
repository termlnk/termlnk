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

import type { IDeviceNameProvider } from '@termlnk/auth';
import { hostname } from 'node:os';

// Default for Node main; pulls in `node:os`. Browser SPA / RN apps must register their
// own provider rather than reuse this class.
export class OsHostnameDeviceNameProvider implements IDeviceNameProvider {
  getName(): string {
    return hostname();
  }
}
