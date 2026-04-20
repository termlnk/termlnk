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

import type { PreloadViteConfig } from 'electron-vite';
import { resolve } from 'pathe';
import { mergeConfig } from 'vite';
import { baseConfig, DESKTOP_ROOT } from './base.config';

const PRELOAD_DIR = resolve(DESKTOP_ROOT, './main/preload');

export default mergeConfig(baseConfig, {
  build: {
    outDir: 'dist/preload',
    lib: {
      entry: resolve(PRELOAD_DIR, './index.ts'),
    },
    externalizeDeps: {
      exclude: [
        '@termlnk/core',
        '@termlnk/rpc',
        '@termlnk/rpc-server',
        '@termlnk/rpc-client',
        '@termlnk/network',
        '@termlnk/themes',
        '@termlnk/electron',
        '@termlnk/electron-main',
        '@termlnk/electron-renderer',
        '@termlnk/ui',
        '@termlnk/terminal',
        '@termlnk/terminal-ui',
        'dayjs',
        'lodash-es',
      ],
      include: [
        '@termlnk/shared',
      ],
    },
  },
} satisfies PreloadViteConfig);
