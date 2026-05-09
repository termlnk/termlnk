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

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { IWebServerConfig } from '../controllers/config.schema';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { createIdentifier, IConfigService, ILogService } from '@termlnk/core';
import { WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';

/**
 * Custom HTTP handler mounted via `IWebServerService.mountRouteHandler`.
 *
 * Returns `true` once the response has been written (res.end / writeHead);
 * returns `false` to let the request continue down the fallback chain.
 */
export type IRouteHandler = (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>;

export interface IStaticFileService {
  /**
   * Handle a static-asset request.
   * - File hit inside dist -> stream with correct mime, status 200, returns true.
   * - SPA history fallback (no extension or missing) -> serve index.html, returns true.
   * - No `staticRoot` configured -> returns false so the caller can 404.
   */
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
}

export const IStaticFileService = createIdentifier<IStaticFileService>('web-server.static-file.service');

/**
 * Mime table — restricted to types the Termlnk SPA actually serves.
 * Mirrors apps/desktop/main/bootstrap.ts so both transports stay aligned.
 */
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
  '.map': 'application/json',
};

/**
 * Node-http static SPA implementation.
 *
 * - Path-traversal guard: resolved path must stay inside `staticRoot`, else 403.
 * - SPA history fallback: extension-less misses fall through to index.html.
 * - GET / HEAD only; other verbs return false so tRPC / custom handlers can claim them.
 *
 * Out of scope for P7.1a:
 * - gzip / brotli negotiation (delegate to the reverse proxy in production).
 * - Long-lived / immutable cache headers (enable once renderer ships hashed filenames).
 */
export class StaticFileService implements IStaticFileService {
  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const root = this._resolveStaticRoot();
    if (!root) {
      return false;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return false;
    }

    const pathname = this._extractPathname(req.url ?? '/');
    const filePath = this._resolveFilePath(root, pathname);
    if (!filePath) {
      // path traversal attempt → 403
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Forbidden');
      return true;
    }

    // Try the real file first, then SPA history fallback to index.html.
    const resolved = (await this._statFileOrFallback(filePath, root)) ?? null;
    if (!resolved) {
      // Not even index.html exists -> let the caller emit a 404.
      return false;
    }

    return this._serveFile(req, res, resolved);
  }

  private _resolveStaticRoot(): string | null {
    const cfg = this._configService.getConfig<IWebServerConfig>(WEB_SERVER_PLUGIN_CONFIG_KEY);
    const root = cfg?.staticRoot;
    if (!root) {
      return null;
    }
    return isAbsolute(root) ? root : resolve(root);
  }

  private _extractPathname(url: string): string {
    const qIdx = url.indexOf('?');
    return qIdx === -1 ? url : url.slice(0, qIdx);
  }

  private _resolveFilePath(root: string, pathname: string): string | null {
    let decoded: string;
    try {
      const normalized = pathname === '/' ? '/index.html' : pathname;
      decoded = decodeURIComponent(normalized).replace(/^\/+/, '');
    } catch {
      return null;
    }
    const filePath = resolve(root, decoded);
    const rel = relative(root, filePath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return null;
    }
    return filePath;
  }

  private async _statFileOrFallback(filePath: string, root: string): Promise<string | null> {
    try {
      const info = await stat(filePath);
      if (info.isFile()) {
        return filePath;
      }
    } catch {
      // fall through to SPA history fallback
    }

    // SPA fallback only kicks in when the request has no extension; otherwise
    // a missing `.png` would be served the HTML body and break the browser.
    const ext = extname(filePath);
    if (ext && ext !== '.html') {
      return null;
    }
    const indexPath = join(root, 'index.html');
    try {
      const info = await stat(indexPath);
      return info.isFile() ? indexPath : null;
    } catch {
      return null;
    }
  }

  private _serveFile(req: IncomingMessage, res: ServerResponse, filePath: string): Promise<boolean> {
    return new Promise((resolveFn) => {
      const ext = extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', mime);

      if (req.method === 'HEAD') {
        res.end();
        resolveFn(true);
        return;
      }

      const stream = createReadStream(filePath);
      stream.on('error', (err) => {
        this._logService.warn(`[StaticFileService] read error for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 500;
        }
        res.end();
        resolveFn(true);
      });
      stream.on('close', () => resolveFn(true));
      stream.pipe(res);
    });
  }
}
