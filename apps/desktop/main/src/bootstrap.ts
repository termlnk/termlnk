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

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { is } from '@electron-toolkit/utils';
import { AgentCorePlugin } from '@termlnk/agent-core';
import { Core, LocaleType, LogLevel } from '@termlnk/core';
import { DatabasePlugin, IDBAdaptorService, SQLiteAdaptor } from '@termlnk/database';
import { ElectronPlugin, IUpdaterService } from '@termlnk/electron';
import { ElectronMainPlugin, FileDialogService, MockUpdaterService } from '@termlnk/electron-main';
import { IExtensionStateService, IExtensionStorageService } from '@termlnk/extension';
import { ExtensionCorePlugin } from '@termlnk/extension-core';
import { IslandCorePlugin } from '@termlnk/island-core';
import { RPCPlugin } from '@termlnk/rpc';
import { IFileDialogService, RPCServerPlugin } from '@termlnk/rpc-server';
import { chadracula } from '@termlnk/themes';
import { app, protocol } from 'electron';
import { dirname, join } from 'pathe';
import { enUS, jaJP, koKR, zhCN, zhTW } from './locales';
import { fixProcessPath } from './shell-path';

// Must run before any child-process spawning (PTY, MCP stdio, etc.)
fixProcessPath();

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

function syncBundledSkills(srcDir: string, destDir: string): void {
  if (!existsSync(srcDir)) {
    return;
  }

  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir)) {
    const srcSkillDir = join(srcDir, entry);
    if (!statSync(srcSkillDir).isDirectory()) {
      continue;
    }

    const srcFile = join(srcSkillDir, 'SKILL.md');
    if (!existsSync(srcFile)) {
      continue;
    }

    const destSkillDir = join(destDir, entry);
    const destFile = join(destSkillDir, 'SKILL.md');

    // Only copy if content differs or doesn't exist
    if (existsSync(destFile)) {
      const srcContent = readFileSync(srcFile, 'utf-8');
      const destContent = readFileSync(destFile, 'utf-8');
      if (srcContent === destContent) {
        continue;
      }
    }

    cpSync(srcSkillDir, destSkillDir, { recursive: true });
  }
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
    ],
  });
  core.registerPlugin(RPCPlugin, { configPath: configDir });

  // Sync bundled skills to config directory before plugin init
  const bundledSkillsSrcDir = is.dev
    ? join(appRoot, '../../../../packages/agent-core/src/bundled-skills')
    : join(appRoot, 'bundled-skills');
  const skillsDir = join(configDir, 'skills');
  syncBundledSkills(bundledSkillsSrcDir, skillsDir);

  // Resolve the agent-hook-cli source bundle so HookLauncherService can
  // copy the POSIX/Windows launchers + Node helper into ~/.config/termlnk/bin/.
  // In dev, read straight from the monorepo; in prod, read from the vite-
  // bundled copy inside the main process dist directory (see
  // `copyAgentHookCliAssets` in configs/main.config.ts).
  const hookCliSrcDir = is.dev
    ? join(appRoot, '../../../../packages/agent-hook-cli/src')
    : join(appRoot, 'agent-hook-cli');

  core.registerPlugin(AgentCorePlugin, {
    bundledSkillsDir: skillsDir,
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
  core.registerPlugin(ElectronPlugin);

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
