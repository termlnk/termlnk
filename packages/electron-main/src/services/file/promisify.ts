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

import * as fs from 'node:fs';
import { promisify } from 'node:util';

export const Promisify = new class {
  get open() { return promisify(fs.open); }
  get close() { return promisify(fs.close); }
  get write() { return promisify(fs.write); }
  get ftruncate() { return promisify(fs.ftruncate); }
  get fdatasync() { return promisify(fs.fdatasync); }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path);

      return true;
    } catch {
      return false;
    }
  }
}();
