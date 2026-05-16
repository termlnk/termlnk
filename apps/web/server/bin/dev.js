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

import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer, loadEnv } from 'vite';
import { createNodeImportMeta, ESModulesEvaluator, ModuleRunner } from 'vite/module-runner';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const entry = resolve(projectRoot, 'src/main.ts');

// Load .env / .env.local / .env.<mode>.local from the package root and copy
// into process.env so main.ts can pick them up via process.env.* without
// callers having to write `dotenv -e ...` in every script. Vite's loadEnv
// owns the layering rules (later files win, *.local overrides committed
// files), and the empty-string prefix lets it pick up our TERMLNK_* names —
// without it loadEnv would only expose VITE_*. .env.example is the
// committed template; runtime files are gitignored.
const mode = process.env.NODE_ENV ?? 'development';
const envFromFiles = loadEnv(mode, projectRoot, '');
for (const [key, value] of Object.entries(envFromFiles)) {
  // Real environment (export FOO=bar) takes precedence over file-based
  // values so CI / docker overrides keep working without resorting to .env
  // edits.
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const server = await createServer({
  configFile: resolve(projectRoot, 'vite.config.ts'),
  root: projectRoot,
  // The dev server itself is just for module transforms; we never serve HTTP
  // from this Vite instance (the termlnk-web tRPC server in main.ts owns
  // port 3000). middlewareMode keeps Vite from trying to bind a duplicate
  // listener.
  server: { middlewareMode: true },
  appType: 'custom',
});

const runner = new ModuleRunner(
  {
    transport: {
      async invoke(data) {
        return server.environments.ssr.hot.handleInvoke(data);
      },
    },
    createImportMeta: createNodeImportMeta,
    // HMR is enabled by default and requires a transport.connect implementation.
    // termlnk-web is a long-running server process — re-evaluating modules on
    // file change would tear down the live tRPC listener mid-flight, which is
    // worse than a clean restart. Keep it off; nodemon-style watchers can wrap
    // this script if reload-on-save is wanted.
    hmr: false,
  },
  new ESModulesEvaluator()
);

const shutdown = async () => {
  try {
    await runner.close();
  } catch {
    /* runner may already be torn down by the entry's own dispose chain */
  }
  await server.close();
};

process.on('SIGINT', () => { void shutdown().then(() => process.exit(0)); });
process.on('SIGTERM', () => { void shutdown().then(() => process.exit(0)); });
process.on('uncaughtException', (err) => {
  console.error('[termlnk-web bootstrap] uncaught:', err);
  void shutdown().then(() => process.exit(1));
});

try {
  await runner.import(entry);
} catch (err) {
  console.error('[termlnk-web bootstrap] failed to load entry:', err);
  await shutdown();
  process.exit(1);
}
