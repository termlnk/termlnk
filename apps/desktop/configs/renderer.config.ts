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

import type { RendererViteConfig } from 'electron-vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'pathe';
import { mergeConfig } from 'vite';
import svgr from 'vite-plugin-svgr';
import { baseConfig, DESKTOP_ROOT } from './base.config';

const RENDERER_ROOT = resolve(DESKTOP_ROOT, './renderer');

export default mergeConfig(baseConfig, {
  root: RENDERER_ROOT,
  base: './',
  build: {
    outDir: 'dist/renderer',
    rolldownOptions: {
      input: {
        main: resolve(RENDERER_ROOT, 'index.html'),
        island: resolve(RENDERER_ROOT, 'island.html'),
      },
    },
  },
  define: {
    ELECTRON: 'true',
  },
  plugins: [
    tailwindcss(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    svgr({
      include: /\.svg(?:\?(?:react|import).*)?$/,
    }),
    react({
      tsDecorators: true,
      plugins: [['@swc/plugin-styled-components', {}]],
    }),
  ],
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: 'termlnk:[local]',
    },
  },
} satisfies RendererViteConfig);
