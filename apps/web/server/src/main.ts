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

/**
 * termlnk-web server entrypoint (P7.3).
 *
 * This process is the user-self-hosted twin of `apps/desktop/main`: same DI
 * container, same plugins (minus the Electron triplet), same business code.
 * The difference is purely transport: the appRouter is exposed over Node http
 * + tRPC standalone HTTP/WS adapters by `@termlnk/web-server` instead of
 * Electron IPC.
 *
 * Per cloud-sync-architecture.md §3.2 / §6.2 / §7.2 + decision Δ24, this
 * entrypoint deliberately does not import any `@termlnk/electron*` package.
 *
 * Plugin chain (lines up with `apps/desktop/main/src/bootstrap.ts` minus the
 * Electron triplet plus `WebServerPlugin`):
 * - DatabasePlugin: SQLite vault + LocalDerivedSecretCipher (no Electron
 *   safeStorage available; device-bound key derivation is the documented
 *   fallback even on the desktop side).
 * - RPCPlugin: shared protocol layer.
 * - AuthPlugin / AuthCorePlugin: identity. IIdleProbe is left at its
 *   `NoopIdleProbe` default since termlnk-web has no system idle signal.
 * - SyncPlugin / SyncCorePlugin: vault sync client (talks to termlnk-server).
 * - RPCServerPlugin: tRPC routers + IFileDialogService default
 *   `NoopFileDialogService` (browser uses File System Access API in P7.4+).
 * - WebServerPlugin: the HTTP/WS surface itself, plus the
 *   IWebServerRouterProvider override that hands `appRouter` over.
 *
 * AgentCorePlugin is a hard dependency of RPCServerPlugin (router resolves
 * agent + skill subroutes), so this entrypoint registers it with the same
 * directory layout the desktop main uses, just rooted under
 * `~/.config/termlnk-web` instead of `~/.config/termlnk`. P7.9 (docker image)
 * will swap the dev-mode bundled-skill resolution for an in-image copy via
 * extraResources analogue.
 *
 * Master password sourcing: WebServerPlugin reads from
 * `TERMLNK_MASTER_PASSWORD` env / `TERMLNK_MASTER_PASSWORD_FILE` per its own
 * config; this entrypoint defers entirely to that resolution chain.
 *
 * Known dev-launch limitation: tsx's esbuild integration does not load the
 * tsconfig `extends` chain across npm-package boundaries, so direct
 * `tsx ./src/main.ts` of cross-package .ts sources hits "Parameter
 * decorators only work when experimental decorators are enabled" on
 * unrelated packages. Production runs build the packages first
 * (`pnpm build`) and start from the compiled `lib/es/` outputs; that path
 * lands together with the docker image work in P7.9.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { AgentCorePlugin } from '@termlnk/agent-core';
import { AuthPlugin } from '@termlnk/auth';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { Core, LocaleType, LogLevel } from '@termlnk/core';
import { DatabasePlugin, IDBAdaptorService, ISecretCipherService, LocalDerivedSecretCipher, SQLiteAdaptor } from '@termlnk/database';
import { ExtensionCorePlugin } from '@termlnk/extension-core';
import { IslandCorePlugin } from '@termlnk/island-core';
import { RPCPlugin } from '@termlnk/rpc';
import { appRouter, RPCServerPlugin } from '@termlnk/rpc-server';
import { SyncPlugin } from '@termlnk/sync';
import { SyncCorePlugin } from '@termlnk/sync-core';
import { IWebServerRouterProvider, WebServerPlugin } from '@termlnk/web-server';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(here, '../../../..');

const configDir = process.env.TERMLNK_WEB_CONFIG_DIR ?? join(homedir(), '.config', 'termlnk-web');
const dbPath = process.env.TERMLNK_WEB_DB_PATH ?? join(configDir, 'termlnk-web.db');
const migrationsFolder = process.env.TERMLNK_WEB_MIGRATIONS_DIR
  ?? join(repoRoot, 'packages/database/src/migrations');
const bundledSkillsDir = process.env.TERMLNK_WEB_BUNDLED_SKILLS_DIR
  ?? join(repoRoot, 'packages/agent-core/src/bundled-skills');
const userSkillsDir = process.env.TERMLNK_WEB_USER_SKILLS_DIR ?? join(configDir, 'skills');
const hookCliSrcDir = process.env.TERMLNK_WEB_HOOK_CLI_DIR
  ?? join(repoRoot, 'packages/agent-hook-cli/src');

const port = Number.parseInt(process.env.TERMLNK_WEB_PORT ?? '3000', 10);
const host = process.env.TERMLNK_WEB_HOST ?? '127.0.0.1';
const staticRoot = process.env.TERMLNK_WEB_STATIC_ROOT;
const tlsCert = process.env.TERMLNK_WEB_TLS_CERT;
const tlsKey = process.env.TERMLNK_WEB_TLS_KEY;

async function bootstrap(): Promise<void> {
  const dbAdaptor = new SQLiteAdaptor({ filename: dbPath, migrationsFolder });
  await dbAdaptor.initialize();

  const core = new Core({
    logLevel: LogLevel.INFO,
    locale: LocaleType.EN_US,
    locales: {},
  });

  core.registerPlugin(DatabasePlugin, {
    migrationsFolder,
    override: [
      [IDBAdaptorService, { useValue: dbAdaptor }],
      // No Electron safeStorage here; LocalDerivedSecretCipher derives a
      // device-bound key (hostname + username + fixed salt) which is enough
      // to keep the SQLite file uninteresting to a casual disk grab.
      [ISecretCipherService, { useClass: LocalDerivedSecretCipher }],
    ],
  });
  core.registerPlugin(RPCPlugin, { configPath: configDir });
  core.registerPlugin(AuthPlugin);
  core.registerPlugin(AuthCorePlugin, {
    cloudBaseUrl: process.env.TERMLNK_CLOUD_BASE_URL,
  });
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(SyncCorePlugin, {
    cloudBaseUrl: process.env.TERMLNK_CLOUD_BASE_URL,
  });
  core.registerPlugin(AgentCorePlugin, {
    bundledSkillsDir,
    userSkillsDir,
    configPath: configDir,
    hookCliSrcDir,
  });
  core.registerPlugin(ExtensionCorePlugin);
  core.registerPlugin(IslandCorePlugin);
  core.registerPlugin(RPCServerPlugin);
  core.registerPlugin(WebServerPlugin, {
    port,
    host,
    staticRoot,
    tlsCert,
    tlsKey,
    masterPasswordFile: process.env.TERMLNK_MASTER_PASSWORD_FILE,
    override: [
      [IWebServerRouterProvider, {
        useValue: { getRouter: () => appRouter },
      }],
    ],
  });

  core.start();

  // Graceful shutdown on SIGINT / SIGTERM so the HTTP server gets a chance
  // to flush in-flight requests and the SQLite WAL gets a clean close.
  const shutdown = (): void => {
    // eslint-disable-next-line no-console
    console.log('[termlnk-web] received signal, shutting down...');
    core.dispose();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // eslint-disable-next-line no-console
  console.log(`[termlnk-web] up on http://${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error('[termlnk-web] fatal bootstrap error:', err);
  process.exit(1);
});
