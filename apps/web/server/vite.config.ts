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

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    target: 'node24',
    rollupOptions: {
      // .mjs forces ESM regardless of whether a package.json type:module sits
      // above; the runtime image runs `node dist/main.mjs` from a bare /app.
      output: {
        entryFileNames: 'main.mjs',
        chunkFileNames: '[name].mjs',
      },
    },
  },
  ssr: {
    noExternal: [/^@termlnk\//],
    external: [
      'better-sqlite3',
      'node-pty',
      'ssh2',
      'cpu-features',
    ],
  },
  resolve: {
    conditions: ['node', 'import'],
    alias: [
      // @xterm/headless and @xterm/addon-serialize ship both CJS and ESM
      // bundles but their package.json "main" points at the CJS file (and
      // @xterm/headless's "module" field even points at a path that doesn't
      // exist). Vite's resolver picks CJS by default; under the SSR
      // ModuleRunner, named imports against that CJS bundle fail because
      // cjs-module-lexer can't statically see `module.exports.Terminal`
      // (the IIFE assigns it at runtime). Bypass the broken metadata and
      // point straight at the ESM build so ESM-to-ESM named imports work.
      {
        find: /^@xterm\/headless$/,
        replacement: '@xterm/headless/lib-headless/xterm-headless.mjs',
      },
      {
        find: /^@xterm\/addon-serialize$/,
        replacement: '@xterm/addon-serialize/lib/addon-serialize.mjs',
      },
    ],
  },
});
