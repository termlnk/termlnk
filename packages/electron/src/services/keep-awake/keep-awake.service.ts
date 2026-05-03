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
import { createIdentifier } from '@termlnk/core';

/**
 * Cross-platform service that prevents the display from sleeping while at
 * least one acquired handle is alive. Implementations manage a single
 * OS-level blocker via reference counting across `acquire()` calls.
 */
export interface IKeepAwakeService {
  /**
   * Acquire a hold to keep the display awake. Reference-counted: the OS
   * blocker stays active until every returned handle is disposed.
   *
   * @param reason Debug label included in log output.
   */
  acquire(reason: string): IDisposable;
}

export const IKeepAwakeService = createIdentifier<IKeepAwakeService>('electron.keep-awake-service');
