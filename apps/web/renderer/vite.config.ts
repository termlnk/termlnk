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

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the monorepo-root version once at build time so WebUpdaterService can
// compare against GitHub Releases without the deployer wiring TERMLNK_VERSION
// manually. apps/web/renderer/package.json itself stays at 0.0.0 (apps don't
// publish), so the meaningful version lives at the repo root.
const rootPkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8'),
) as { version: string };

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
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
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
    // In dev, the SPA is served from this Vite dev server while the tRPC /
    // auth endpoints are owned by the termlnk-web Node server on port 3000.
    // Same-origin fetch / WebSocket calls in WebShell + WebRPCClientService
    // resolve against http://localhost:5179, so without a proxy
    //   GET /__termlnk-web/status   -> 404 (vite dev has no such route)
    //   POST /trpc/...              -> 404
    //   WS   /trpc-ws               -> 404
    // The proxy below forwards all three to the actual server. In production
    // (Docker image), the SPA is served by web-server itself, same origin —
    // no proxy needed there.
    proxy: {
      '/__termlnk-web': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
      '/trpc': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
      '/trpc-ws': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
        ws: true,
      },
    },
  },
});
