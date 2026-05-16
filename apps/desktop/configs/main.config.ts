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

import type { MainViteConfig } from 'electron-vite';
import type { Plugin } from 'vite';
import { cp } from 'node:fs/promises';
import { mergeConfig } from 'electron-vite';
import { resolve } from 'pathe';
import { getGitHash } from '../scripts/git';
import { baseConfig, DESKTOP_ROOT } from './base.config';

const MAIN_DIR = resolve(DESKTOP_ROOT, './main/src');
const MIGRATIONS_SRC = resolve(DESKTOP_ROOT, '../../packages/database/src/migrations');
const AGENT_HOOK_CLI_SRC = resolve(DESKTOP_ROOT, '../../packages/agent-hook-cli/src');

const copyMigrationAssets = (): Plugin => ({
  name: 'copy-migration-assets',
  async closeBundle() {
    const dest = resolve(DESKTOP_ROOT, './dist/main/migrations');
    await cp(MIGRATIONS_SRC, dest, { recursive: true });
  },
});

/**
 * Bundle the `@termlnk/agent-hook-cli` sources (POSIX launcher, Windows .cmd
 * launcher, Node helper) into the main process dist directory. At runtime,
 * `IHookLauncherService.install()` copies these files into
 * `~/.config/termlnk/bin/` so external AI agents can invoke the hook helper
 * regardless of which terminal they run in.
 */
const copyAgentHookCliAssets = (): Plugin => ({
  name: 'copy-agent-hook-cli-assets',
  async closeBundle() {
    const dest = resolve(DESKTOP_ROOT, './dist/main/agent-hook-cli');
    await cp(AGENT_HOOK_CLI_SRC, dest, { recursive: true });
  },
});

export default mergeConfig(baseConfig, {
  plugins: [
    copyMigrationAssets(),
    copyAgentHookCliAssets(),
  ],
  build: {
    outDir: 'dist/main',
    lib: {
      entry: resolve(MAIN_DIR, './index.ts'),
    },
    externalizeDeps: {
      exclude: [
        '@termlnk/core',
        '@termlnk/ai',
        '@termlnk/database',
        '@termlnk/rpc',
        '@termlnk/rpc-server',
        '@termlnk/rpc-electron',
        '@termlnk/network',
        '@termlnk/themes',
        '@termlnk/electron',
        '@termlnk/electron-main',
        '@termlnk/mcp',
        '@termlnk/agent-core',
        '@termlnk/skill',
        '@termlnk/terminal',
        '@termlnk/electron-renderer',
        'dayjs',
        'lodash-es',
        '@modelcontextprotocol/sdk',
        '@earendil-works/pi-ai',
        '@earendil-works/pi-agent-core',
      ],
      include: [
        '@termlnk/shared',
        'ssh2',
        'cpu-features',
        'node-pty',
        'better-sqlite3',
        '@termlnk/macos-utils',
      ],
    },
  },
  ssr: {
    external: [
      'ssh2',
      'cpu-features',
      'node-pty',
      'better-sqlite3',
      '@termlnk/macos-utils',
    ],
  },
  define: {
    ELECTRON: true,
    GIT_COMMIT_HASH: JSON.stringify(getGitHash()),
  },
} satisfies MainViteConfig, false);
