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

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { is } from '@electron-toolkit/utils';
import { AgentCorePlugin, NodeProxyFetchProvider } from '@termlnk/agent-core';
import { AuthPlugin, IIdleProbe } from '@termlnk/auth';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { Core, IUpdaterService, LocaleType, LogLevel } from '@termlnk/core';
import { DatabasePlugin, IDBAdaptorService, ISecretCipherService, SQLiteAdaptor } from '@termlnk/database';
import { ElectronPlugin } from '@termlnk/electron';
import { ElectronIdleProbe, ElectronMainPlugin, FileDialogService, MockUpdaterService, SafeStorageCipher } from '@termlnk/electron-main';
import { IExtensionStateService, IExtensionStorageService } from '@termlnk/extension';
import { ExtensionCorePlugin } from '@termlnk/extension-core';
import { IslandCorePlugin } from '@termlnk/island-core';
import { IFetchProvider, NetworkPlugin } from '@termlnk/network';
import { RPCPlugin } from '@termlnk/rpc';
import { IFileDialogService, RPCServerPlugin } from '@termlnk/rpc-server';
import { SyncPlugin } from '@termlnk/sync';
import { SyncCorePlugin } from '@termlnk/sync-core';
import { chadracula } from '@termlnk/themes';
import { app, protocol } from 'electron';
import { dirname, join, relative } from 'pathe';
import { enUS, jaJP, koKR, zhCN, zhTW } from './locales';
import { fixProcessPath } from './shell-path';

// Must run before any child-process spawning (PTY, MCP stdio, etc.)
fixProcessPath();

// Single-instance lock — Windows/Linux fork a new process on each launch
// while macOS LaunchServices already deduplicates GUI launches; the lock
// covers CLI launches uniformly. Must run before app.whenReady().
// SingleInstanceController handles the 'second-instance' event.
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

// GPU acceleration & rendering optimizations.
// These must be set before app.whenReady() per Chromium requirements.
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

// Renderer dist directory (inside asar in production)
const rendererDir = join(appRoot, '../renderer');

// Production entry: app:// custom protocol URL served by the handler above.
// Dev entry: localhost URL from ELECTRON_RENDERER_URL env.
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
    theme: chadracula,
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

  // NetworkPlugin: register before plugins that issue HTTP traffic so they
  // resolve HTTPService against this binding. Override IFetchProvider with
  // NodeProxyFetchProvider so all in-process HTTP (LLM provider sync, MCP
  // registry, web fetch tool, future direct callers) routes through the
  // user's configured HTTP/SOCKS5 proxy without each call site rebuilding
  // the dispatcher. useFetchImpl forces the Fetch implementation in main
  // process — XHR is browser-only and the default switch picks XHR when
  // `window` is absent (the inverse of what we need here).
  core.registerPlugin(NetworkPlugin, {
    useFetchImpl: true,
    override: [
      [IFetchProvider, { useClass: NodeProxyFetchProvider }],
    ],
  });

  // Auth/Sync contracts ship with Noop ITokenRefresher / ISyncTransportService;
  // Phase 3 swaps in HTTP impls via plugin overrides.
  core.registerPlugin(AuthPlugin);
  core.registerPlugin(AuthCorePlugin, {
    // powerMonitor-backed probe makes autoLockIdleMinutes effective on Electron;
    // auth-core's NoopIdleProbe stays the default for pure Node hosts.
    override: [
      [IIdleProbe, { useClass: ElectronIdleProbe }],
    ],
  });
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(SyncCorePlugin);

  // Bundled skills must live outside app.asar — Node's fs APIs throw ENOENT
  // on asar virtual directory entries; extraResources drops them into
  // Contents/Resources/bundled-skills/ on the real filesystem.
  const bundledSkillsDir = is.dev
    ? join(appRoot, '../../../../packages/agent-core/src/bundled-skills')
    : join(process.resourcesPath, 'bundled-skills');
  const userSkillsDir = join(configDir, 'skills');

  // Resolve the agent-hook-cli source bundle so HookLauncherService can
  // copy the POSIX/Windows launchers + Node helper into ~/.config/termlnk/bin/.
  // In dev, read straight from the monorepo; in prod, read from the vite-
  // bundled copy inside the main process dist directory (see
  // `copyAgentHookCliAssets` in configs/main.config.ts).
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

  // Dev-only: swap the real UpdaterService for a scripted mock when
  // TERMLNK_MOCK_UPDATER is set, so the updater UI (button + dialog +
  // progress bar) can be exercised without a packaged build. Accepts
  // `normal`, `check-error`, `download-error`, or `no-update`.
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
  console.error('[Bootstrap] Fatal initialization error:', err);
  app.exit(1);
});
