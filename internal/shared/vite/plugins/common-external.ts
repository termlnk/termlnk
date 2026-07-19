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

export default {
  react: {
    global: 'React',
    name: 'react',
    version: '^16.9.0 || ^17.0.0 || ^18.0.0 || ^19.0.0 || ^19.0.0-rc',
  },
  'react/jsx-runtime': {
    global: 'React',
    name: 'react',
    version: 'react',
  },
  'react-dom': {
    global: 'ReactDOM',
    name: 'react-dom',
    version: '^16.9.0 || ^17.0.0 || ^18.0.0 || ^19.0.0 || ^19.0.0-rc',
  },
  'react-dom/client': {
    global: 'ReactDOM',
    name: 'react-dom',
    version: 'react-dom',
  },
  rxjs: {
    global: 'rxjs',
    name: 'rxjs',
    version: '>=7.0.0',
  },
  'rxjs/operators': {
    global: 'rxjs.operators',
    name: 'rxjs',
    version: 'rxjs',
  },
  '@wendellhu/redi': {
    global: '@wendellhu/redi',
    name: '@wendellhu/redi',
    version: '1.1.2',
  },
  '@wendellhu/redi/react-bindings': {
    global: '@wendellhu/redi/react-bindings',
    name: '@wendellhu/redi',
    version: '@wendellhu/redi',
  },

  electron: {
    global: 'electron',
    name: 'electron',
    version: '42.7.0',
  },

  // Node.js native / server-side packages (not bundleable by Rollup)
  ssh2: {
    global: 'ssh2',
    name: 'ssh2',
    version: '^1.17.0',
  },
  socks: {
    global: 'socks',
    name: 'socks',
    version: '^2.8.9',
  },
  trzsz: {
    global: 'trzsz',
    name: 'trzsz',
    version: '^1.1.5',
  },
  'zmodem.js': {
    global: 'zmodem.js',
    name: 'zmodem.js',
    version: '^0.1.10',
  },
  'better-sqlite3': {
    global: 'better-sqlite3',
    name: 'better-sqlite3',
    version: '^12.11.1',
  },

  // Design package dependencies
  '@lobehub/icons': {
    global: '@lobehub/icons',
    name: '@lobehub/icons',
    version: '^5.8.0',
  },
  'lucide-react': {
    global: 'lucide-react',
    name: 'lucide-react',
    version: '^1.25.0',
  },
  dayjs: {
    global: 'dayjs',
    name: 'dayjs',
    version: '^1.11.21',
  },
  nanoid: {
    global: 'nanoid',
    name: 'nanoid',
    version: '^5.1.16',
  },
  'react-resizable-panels': {
    global: 'react-resizable-panels',
    name: 'react-resizable-panels',
    version: '^4.12.1',
  },
};
