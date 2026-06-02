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

// termlnk-web server entrypoint. User-self-hosted twin of apps/desktop/main: same DI
// container and business plugins; the appRouter is exposed over Node http + tRPC
// HTTP/WS adapters instead of Electron IPC. Deliberately imports no @termlnk/electron*
// package.
//
// Master password sourcing is delegated entirely to WebServerPlugin via
// the TERMLNK_MASTER_PASSWORD env var.
//
// Known dev-launch limitation: tsx's esbuild integration does not load the tsconfig
// `extends` chain across npm-package boundaries, so direct `tsx ./src/main.ts` trips
// "Parameter decorators only work when experimental decorators are enabled" on cross-
// package .ts sources. Production builds the packages first and starts from `lib/es/`.

import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { AgentCorePlugin, NodeProxyFetchProvider } from '@termlnk/agent-core';
import { AuthPlugin, IDeviceNameProvider } from '@termlnk/auth';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { Core, LocaleType, LogLevel } from '@termlnk/core';
import { DatabasePlugin, IDBAdaptorService, ISecretCipherService, LocalDerivedSecretCipher, SQLiteAdaptor } from '@termlnk/database';
import { ExtensionCorePlugin } from '@termlnk/extension-core';
import { IFetchProvider, NetworkPlugin } from '@termlnk/network';
import { RPCPlugin } from '@termlnk/rpc';
import { appRouter, RPCServerPlugin } from '@termlnk/rpc-server';
import { SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { SharedTerminalCorePlugin } from '@termlnk/shared-terminal-core';
import { SyncPlugin } from '@termlnk/sync';
import { SyncCorePlugin } from '@termlnk/sync-core';
import { IWebServerRouterProvider, WebServerPlugin } from '@termlnk/web-server';
import { OsHostnameDeviceNameProvider } from './platform/os-hostname-device-name-provider.service';

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

// Mirrors apps/desktop/main/src/bootstrap.ts: TERMLNK_CLOUD_BASE_URL when set,
// otherwise the baked-in production endpoint so a fresh self-hosted deploy can
// sign in against cloud.termlnk.com without any extra configuration.
const PRODUCTION_CLOUD_BASE_URL = 'https://cloud.termlnk.com/v1';
const cloudBaseUrl = process.env.TERMLNK_CLOUD_BASE_URL?.trim() || PRODUCTION_CLOUD_BASE_URL;

// Relay shares the cloud host (HTTPS + WSS on the same origin); derive directly
// so a single env var is the source of truth. Same scheme swap as desktop.
const relayBaseUrl = cloudBaseUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
// Invite landing page lives at the cloud origin root (outside `/v1`); strip the
// version suffix and any trailing slashes.
const inviteBaseUrl = cloudBaseUrl.replace(/\/v\d+\/?$/, '').replace(/\/+$/, '');

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
      [ISecretCipherService, { useClass: LocalDerivedSecretCipher }],
    ],
  });
  core.registerPlugin(RPCPlugin, { configPath: configDir });
  core.registerPlugin(NetworkPlugin, {
    useFetchImpl: true,
    override: [
      [IFetchProvider, { useClass: NodeProxyFetchProvider }],
    ],
  });
  core.registerPlugin(AuthPlugin);
  core.registerPlugin(AuthCorePlugin, {
    cloudBaseUrl,
    override: [
      [IDeviceNameProvider, { useClass: OsHostnameDeviceNameProvider }],
    ],
  });
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(SyncCorePlugin, {
    cloudBaseUrl,
  });
  core.registerPlugin(SharedTerminalPlugin, { cloudBaseUrl, relayBaseUrl, inviteBaseUrl });
  core.registerPlugin(SharedTerminalCorePlugin);
  core.registerPlugin(AgentCorePlugin, {
    bundledSkillsDir,
    userSkillsDir,
    configPath: configDir,
    hookCliSrcDir,
  });
  core.registerPlugin(ExtensionCorePlugin);
  core.registerPlugin(RPCServerPlugin);
  core.registerPlugin(WebServerPlugin, {
    port,
    host,
    staticRoot,
    tlsCert,
    tlsKey,
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
