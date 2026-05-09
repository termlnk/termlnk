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

// Skeleton config — P7.4 will extend with @tanstack/router-plugin, tailwindcss,
// and the desktop renderer plugin chain (minus Electron triplet, plus
// WebRendererPlugin from @termlnk/web-renderer).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    port: 5179,
  },
});
