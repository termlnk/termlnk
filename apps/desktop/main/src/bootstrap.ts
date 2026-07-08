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
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { is } from '@electron-toolkit/utils';
import { AgentCorePlugin, NodeProxyFetchProvider } from '@termlnk/agent-core';
import { AuthPlugin, IDeviceNameProvider, IIdleProbe } from '@termlnk/auth';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { Core, ILogService, IUpdaterService, LocaleType, LogLevel } from '@termlnk/core';
import { ConfigRepository, DatabasePlugin, IDBAdaptorService, ISecretCipherService, SQLiteAdaptor } from '@termlnk/database';
import { ElectronPlugin } from '@termlnk/electron';
import { ElectronIdleProbe, ElectronMainPlugin, FileDialogService, MockUpdaterService, SafeStorageCipher } from '@termlnk/electron-main';
import { IExtensionStateService, IExtensionStorageService } from '@termlnk/extension';
import { ExtensionCorePlugin } from '@termlnk/extension-core';
import { IslandCorePlugin } from '@termlnk/island-core';
import { IFetchProvider, NetworkPlugin } from '@termlnk/network';
import { RPCPlugin } from '@termlnk/rpc';
import { IFileDialogService, RPCServerPlugin } from '@termlnk/rpc-server';
import { SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { SharedTerminalCorePlugin } from '@termlnk/shared-terminal-core';
import { SyncPlugin } from '@termlnk/sync';
import { SyncCorePlugin } from '@termlnk/sync-core';
import { termlnkDark } from '@termlnk/themes';
import { app, ipcMain, protocol } from 'electron';
import { dirname, join, relative } from 'pathe';
import { enUS, jaJP, koKR, zhCN, zhTW } from './locales';
import { OsHostnameDeviceNameProvider } from './platform/os-hostname-device-name-provider.service';
import { fixProcessPath } from './shell-path';

// Load apps/desktop/.env into process.env in unpackaged runs. Vite's `define` doesn't
// rewrite `process.env.*` in Node-target main bundles, and we don't ship dotenv as a
// runtime dependency — this tiny loader covers TERMLNK_* style flags the same way
// EAS/Expo handles `.env` on the mobile side. Packaged builds skip it (no .env on disk).
function loadDotenv(): void {
  if (app.isPackaged) {
    return;
  }
  const envPath = resolve(process.cwd(), '.env');
  let content: string;
  try {
    content = readFileSync(envPath, 'utf-8');
  } catch {
    return;
  }
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))) {
      value = value.slice(1, -1);
    }
    // Shell-provided values win over .env so `TERMLNK_X=... pnpm dev` overrides the file.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotenv();

// Must run before any child-process spawning (PTY, MCP stdio, etc.)
fixProcessPath();

// Must run before app.whenReady(); covers Windows/Linux fork-per-launch and CLI launches
// uniformly (macOS LaunchServices already dedupes GUI launches).
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

// Boot UI config channel: renderer awaits this via `window.__TERMLNK_BOOT__.getUIConfig()`
// during Core creation so the initial theme reflects the persisted preference and
// avoids a mid-boot flash (default -> user pref). The handler is registered once at
// module top level (before app.whenReady) so the IPC channel exists before any window
// loads; it resolves only after DatabasePlugin + core.start() bind ConfigRepository.
const BOOT_UI_CONFIG_CHANNEL = 'termlnk:boot-ui-config';
let bootConfigResolve!: (repo: ConfigRepository) => void;
let bootConfigReject!: (err: unknown) => void;
const bootConfigReadyPromise = new Promise<ConfigRepository>((resolve, reject) => {
  bootConfigResolve = resolve;
  bootConfigReject = reject;
});

ipcMain.handle(BOOT_UI_CONFIG_CHANNEL, async () => {
  try {
    const repo = await bootConfigReadyPromise;
    return await repo.get('ui.config');
  } catch (err) {
    console.error('[boot-ui-config] failed:', err);
    return null;
  }
});

// Must be set before app.whenReady() per Chromium requirements.
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

app.on('window-all-closed', () => {
  app.quit();
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
  {
    scheme: 'termlnk-ext',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

const appRoot = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = is.dev
  ? join(appRoot, '../../../../packages/database/src/migrations')
  : join(appRoot, 'migrations');
const configDir = join(homedir(), '.config', 'termlnk');
const dbPath = join(configDir, 'termlnk.db');
const dbAdaptor = new SQLiteAdaptor({ filename: dbPath, migrationsFolder });

const rendererDir = join(appRoot, '../renderer');

// Dev → ELECTRON_RENDERER_URL (localhost); prod → app:// served by the handler below.
const url = is.dev && process.env.ELECTRON_RENDERER_URL ? process.env.ELECTRON_RENDERER_URL : 'app://termlnk/';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function resolveExtensionAssetPath(
  requestURL: string,
  storageService: IExtensionStorageService
): string | null {
  const parsed = new URL(requestURL);
  const extensionId = parsed.hostname;
  if (!extensionId) {
    return null;
  }
  let relativePath = '';
  try {
    relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (!relativePath) {
    return null;
  }
  return storageService.resolveExtensionFilePath(extensionId, relativePath);
}

function withAsarEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const prev = (process as any).noAsar;
  (process as any).noAsar = false;
  return fn().finally(() => {
    (process as any).noAsar = prev;
  });
}

// Production cloud endpoint baked into the build; used whenever the env var is unset.
const PRODUCTION_CLOUD_BASE_URL = 'https://cloud.termlnk.com/v1';

function resolveCloudBaseUrl(): string {
  return process.env.TERMLNK_CLOUD_BASE_URL?.trim() || PRODUCTION_CLOUD_BASE_URL;
}

// Relay shares the cloud host (HTTPS + WSS on the same origin); derive from cloudBaseUrl
// for a single source of truth. Dev overrides via TERMLNK_RELAY_BASE_URL.
function resolveRelayBaseUrl(cloudBaseUrl: string | undefined): string | undefined {
  const envValue = process.env.TERMLNK_RELAY_BASE_URL?.trim();
  if (envValue && !app.isPackaged) {
    return envValue;
  }
  if (!cloudBaseUrl) {
    return undefined;
  }
  return cloudBaseUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
}

// Invite landing page lives at the cloud origin root (outside `/v1`), so the shared URL
// stays short. Strip `/v1` from cloudBaseUrl to derive.
function resolveInviteBaseUrl(cloudBaseUrl: string | undefined): string | undefined {
  const envValue = process.env.TERMLNK_INVITE_BASE_URL?.trim();
  if (envValue && !app.isPackaged) {
    return envValue;
  }
  if (!cloudBaseUrl) {
    return undefined;
  }
  return cloudBaseUrl.replace(/\/v\d+\/?$/, '').replace(/\/+$/, '');
}

function resolveRendererAssetPath(requestURL: string): string | null {
  const { hostname, pathname } = new URL(requestURL);
  if (hostname !== 'termlnk') {
    return null;
  }

  let decodedPath = '';
  try {
    const path = pathname === '/' ? '/index.html' : pathname;
    decodedPath = decodeURIComponent(path).replace(/^\/+/, '');
  } catch {
    return null;
  }

  const filePath = resolve(rendererDir, decodedPath);
  const relPath = relative(rendererDir, filePath);
  if (relPath.startsWith('..') || isAbsolute(relPath)) {
    return null;
  }

  return filePath;
}

// Register protocol handler BEFORE core.start() to guarantee
// the handler is ready before any window loads an app:// URL.
app.whenReady().then(async () => {
  protocol.handle('app', async (request) => {
    const filePath = resolveRendererAssetPath(request.url);
    if (!filePath) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const data = await withAsarEnabled(() => readFile(filePath));
      const ext = extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      return new Response(data, {
        headers: { 'Content-Type': mimeType },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  // Initialize database BEFORE registering plugins, since plugin
  // registration eagerly triggers onStarting() and services may
  // access the database immediately.
  await dbAdaptor.initialize();

  const core = new Core({
    theme: termlnkDark,
    logLevel: LogLevel.INFO,
    locale: LocaleType.EN_US,
    locales: { enUS, zhCN, jaJP, koKR, zhTW },
  });
  core.registerPlugin(DatabasePlugin, {
    migrationsFolder,
    override: [
      [IDBAdaptorService, { useValue: dbAdaptor }],
      // OS keystore for sensitive creds; auto-falls back to LocalDerivedSecretCipher when unavailable.
      [ISecretCipherService, { useClass: SafeStorageCipher }],
    ],
  });
  core.registerPlugin(RPCPlugin, { configPath: configDir });

  // Register before any plugin that issues HTTP traffic. NodeProxyFetchProvider routes
  // every in-process HTTP call through the user's configured proxy. useFetchImpl forces
  // Fetch in the main process — the default switch picks XHR when `window` is absent.
  core.registerPlugin(NetworkPlugin, {
    useFetchImpl: true,
    override: [
      [IFetchProvider, { useClass: NodeProxyFetchProvider }],
    ],
  });

  // Cloud endpoint: TERMLNK_CLOUD_BASE_URL when set, otherwise the baked-in PRODUCTION_CLOUD_BASE_URL.
  const cloudBaseUrl = resolveCloudBaseUrl();
  const relayBaseUrl = resolveRelayBaseUrl(cloudBaseUrl);
  const inviteBaseUrl = resolveInviteBaseUrl(cloudBaseUrl);
  const logService = core.getInjector().get(ILogService);
  logService.log(`[Bootstrap] cloudBaseUrl = ${cloudBaseUrl}`);
  logService.log(`[Bootstrap] relayBaseUrl = ${relayBaseUrl ?? '(unset — shared-terminal disabled)'}`);
  logService.log(`[Bootstrap] inviteBaseUrl = ${inviteBaseUrl ?? '(unset — invite URL cannot be stamped)'}`);
  core.registerPlugin(AuthPlugin);
  core.registerPlugin(AuthCorePlugin, {
    cloudBaseUrl,
    // Electron-only overrides for IIdleProbe / IDeviceNameProvider; the adapters live in
    // ./platform/ so auth-core stays free of node:os imports.
    override: [
      [IIdleProbe, { useClass: ElectronIdleProbe }],
      [IDeviceNameProvider, { useClass: OsHostnameDeviceNameProvider }],
    ],
  });
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(SyncCorePlugin, { cloudBaseUrl });

  // Shared-terminal must follow AuthCorePlugin because HttpCollabInviteTransportService
  // resolves TokenManager from the same singleton AuthCorePlugin binds. DatabasePlugin
  // is already up so CollabInviteTokenRepository / ConfigRepository / ISecretCipherService
  // are available for DaemonKeypairService and PairingService.
  core.registerPlugin(SharedTerminalPlugin, { cloudBaseUrl, relayBaseUrl, inviteBaseUrl });
  core.registerPlugin(SharedTerminalCorePlugin);

  // Bundled skills must live outside app.asar — Node's fs APIs throw ENOENT
  // on asar virtual directory entries; extraResources drops them into
  // Contents/Resources/bundled-skills/ on the real filesystem.
  const bundledSkillsDir = is.dev
    ? join(appRoot, '../../../../packages/agent-core/src/bundled-skills')
    : join(process.resourcesPath, 'bundled-skills');
  const userSkillsDir = join(configDir, 'skills');

  // Dev reads the agent-hook-cli source straight from the monorepo; prod reads from the
  // vite-bundled copy inside the main process dist directory.
  const hookCliSrcDir = is.dev
    ? join(appRoot, '../../../../packages/agent-hook-cli/src')
    : join(appRoot, 'agent-hook-cli');

  core.registerPlugin(ElectronPlugin);
  core.registerPlugin(AgentCorePlugin, {
    bundledSkillsDir,
    userSkillsDir,
    configPath: configDir,
    hookCliSrcDir,
  });
  core.registerPlugin(ExtensionCorePlugin);
  core.registerPlugin(IslandCorePlugin);
  core.registerPlugin(RPCServerPlugin, {
    override: [
      [IFileDialogService, { useClass: FileDialogService }],
    ],
  });

  // Dev-only: TERMLNK_MOCK_UPDATER swaps in a scripted mock so the updater UI can be
  // exercised without a packaged build. Accepts `normal`, `check-error`, `download-error`,
  // or `no-update`.
  const useMockUpdater = !app.isPackaged && process.env.TERMLNK_MOCK_UPDATER !== undefined;
  core.registerPlugin(ElectronMainPlugin, {
    url,
    preload: join(appRoot, '../preload/index.mjs'),
    override: useMockUpdater
      ? [[IUpdaterService, { useClass: MockUpdaterService }]]
      : undefined,
  });
  core.start();

  const injector = core.getInjector();
  // Unblock the boot-ui-config IPC handler now that DatabasePlugin has bound
  // ConfigRepository. Any renderer invoke that landed earlier will resolve.
  try {
    bootConfigResolve(injector.get(ConfigRepository));
  } catch (err) {
    bootConfigReject(err);
  }
  const extensionStateService = injector.get(IExtensionStateService);
  await extensionStateService.load();
  const extensionStorageService = injector.get(IExtensionStorageService);

  protocol.handle('termlnk-ext', async (request) => {
    const filePath = resolveExtensionAssetPath(request.url, extensionStorageService);
    if (!filePath) {
      return new Response('Not Found', { status: 404 });
    }
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      return new Response(data, {
        headers: { 'Content-Type': mimeType },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}).catch((err) => {
  // Bootstrap may fail before any ILogService is bound; stderr is the only sink left.
  console.error('[Bootstrap] Fatal initialization error:', err);
  app.exit(1);
});
