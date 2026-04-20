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

import type { INodeProcess } from './platform';
import { isMacintosh, isWindows } from './platform';

let safeProcess: Omit<INodeProcess, 'arch'> & { arch: string | undefined };
declare const process: INodeProcess;

if (typeof process !== 'undefined' && typeof process?.versions?.node === 'string') {
  // Native node.js environment
  safeProcess = {
    get platform() { return process.platform; },
    get arch() { return process.arch; },
    get env() { return process.env; },
    cwd() { return process.cwd(); },
  };
} else {
  // Web environment
  safeProcess = {
    // Supported
    get platform() { return isWindows ? 'win32' : isMacintosh ? 'darwin' : 'linux'; },
    get arch() { return undefined; /* arch is undefined in web */ },
    // Unsupported
    get env() { return {}; },
    cwd() { return '/'; },
  };
}

/**
 * Provides safe access to the `cwd` property in node.js, sandboxed or web
 * environments.
 *
 * Note: in web, this property is hardcoded to be `/`.
 *
 * @skipMangle
 */
export const cwd = safeProcess.cwd;

/**
 * Provides safe access to the `env` property in node.js, sandboxed or web
 * environments.
 *
 * Note: in web, this property is hardcoded to be `{}`.
 */
export const env = safeProcess.env;

/**
 * Provides safe access to the `platform` property in node.js, sandboxed or web
 * environments.
 */
export const platform = safeProcess.platform;

/**
 * Provides safe access to the `arch` method in node.js, sandboxed or web
 * environments.
 * Note: `arch` is `undefined` in web
 */
export const arch = safeProcess.arch;
