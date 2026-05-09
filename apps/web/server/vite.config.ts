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

import { defineConfig } from 'vite';

/**
 * vite-node config for the termlnk-web server entrypoint.
 *
 * Why vite-node and not tsx:
 *
 * tsx hands raw .ts files to esbuild and lets Node's own ESM/CJS resolver
 * walk workspace imports, which means cross-package decorator config gets
 * lost (different file matchers per directory) and any third-party dep
 * exporting only an ESM "import" condition (e.g. `@mariozechner/pi-ai`)
 * blows up the moment a CJS-context workspace package tries to require it.
 * vite-node sidesteps both: it runs an in-memory Vite dev server, so every
 * `@termlnk/*` import flows through Vite's plugin chain, and Vite's resolver
 * picks up the `import` export condition without caring about the consumer's
 * declared module type.
 *
 * Configuration:
 * - `ssr.noExternal: [/^@termlnk\//]` — refuse to externalize workspace
 *   packages so Vite owns their transform end-to-end (decorators, JSX,
 *   tsconfig paths). Without this, workspace deps get handed to Node, and
 *   Node hits the same module-type mismatch that tsx already chokes on.
 * - `ssr.external` — keep native bindings (better-sqlite3, node-pty, ssh2,
 *   cpu-features) out of Vite's transform path; they ship pre-built `.node`
 *   binaries that must reach the runtime intact.
 * - `resolve.conditions: ['node', 'import']` — match the desktop main
 *   process's behaviour and prefer the ESM export condition for libraries
 *   that ship dual builds.
 */
export default defineConfig({
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
  },
});
