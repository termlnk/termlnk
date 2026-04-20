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

import type { InlineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import vitePluginExternal from 'vite-plugin-external';
import svgr from 'vite-plugin-svgr';
import { autoDetectedExternalPlugin, trimClassNamePlugin } from './plugins';

// https://vite.dev/config/
const sharedConfig = {
  configFile: false,
  build: {
    target: 'chrome120',
    cssMinify: false,
    rolldownOptions: {
      onwarn: (warning, warn) => {
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT' && warning.exporter === 'react') {
          return;
        }
        warn(warning);
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.BUILD_TIMESTAMP': JSON.stringify(Math.floor(Date.now() / 1000)),
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      generateScopedName: 'termlnk:[local]',
    },
  },
  plugins: [
    trimClassNamePlugin(),
    autoDetectedExternalPlugin(),
    svgr({
      include: /\.svg(?:\?(?:react|import).*)?$/,
    }),
    react({
      tsDecorators: true,
      plugins: [['@swc/plugin-styled-components', {}]],
    }),
    vitePluginExternal({
      nodeBuiltins: true,
    }),
  ],
} satisfies InlineConfig;

export default sharedConfig;
