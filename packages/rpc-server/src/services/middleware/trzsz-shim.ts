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

/**
 * trzsz CJS shim for ESM environments.
 *
 * The `trzsz` library detects a Node.js environment via `require.resolve("fs")`.
 * When bundled into an ESM output by Vite, `require` is not available (or shadowed
 * by a later `const require` declaration from other dependencies like zod, causing
 * a TDZ error). This makes trzsz fall back to browser APIs (`window.showOpenFilePicker`)
 * which don't exist in Node.js.
 *
 * This shim loads trzsz via CJS `require()` at runtime so the detection works correctly.
 */
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const _trzsz = _require('trzsz');

export const TrzszFilter: typeof import('trzsz').TrzszFilter = _trzsz.TrzszFilter;
