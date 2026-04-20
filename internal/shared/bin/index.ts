/*
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

#!/usr/bin/env -S npx tsx

import type { IBuildOptions } from '../vite';
import { argv } from 'node:process';
import { build } from '../vite';

const argvs = argv.slice(2);
const [command, ...args] = argvs;

if (command === 'build') {
  const options: IBuildOptions = {
    skipUMD: true,
  };

  if (args.includes('--cleanup')) {
    options.cleanup = true;
  }
  if (args.includes('--nodeFirst')) {
    options.nodeFirst = true;
  }

  build(options);
}
