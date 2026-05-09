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

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

// Mirrors apps/desktop/configs/renderer.config.ts plugin chain. Differs only
// in transport (no Electron preload) and the absolute base path: termlnk-web
// is served from the root of a domain via @termlnk/web-server's static SPA
// handler, so `base: '/'` keeps asset URLs origin-relative for sub-path-aware
// reverse proxies.
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
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
  server: {
    port: 5179,
  },
});
