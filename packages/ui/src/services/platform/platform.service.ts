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

/**
 * A service to provide context info of the host service.
 */
export interface IPlatformService {
  readonly isMac: boolean;
  readonly isWindows: boolean;
  readonly isLinux: boolean;
}

export const IPlatformService = createIdentifier<IPlatformService>('ui.platform-service');

const RE_MAC = /Mac/;
const RE_WINDOWS = /Windows/;
const RE_LINUX = /Linux/;

export class PlatformService implements IPlatformService {
  get isMac(): boolean {
    return RE_MAC.test(navigator.userAgent);
  }

  get isWindows(): boolean {
    return RE_WINDOWS.test(navigator.userAgent);
  }

  get isLinux(): boolean {
    return RE_LINUX.test(navigator.userAgent);
  }
}
