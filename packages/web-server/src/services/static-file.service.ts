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
 * 自定义路由 handler——挂在 IWebServerService.mountRouteHandler 上。
 *
 * 返回 true 表示已写出响应（res.end / res.writeHead 等）；返回 false 让请求继续走兜底链。
 */
export type IRouteHandler = (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean>;

export interface IStaticFileService {
  /**
   * 处理静态资源请求。
   * - 命中 dist 内文件 → 流式响应 + 正确 mime + 200 → 返回 true
   * - SPA history fallback：路径不带后缀 / 不存在 → 返回 index.html → 返回 true
   * - 未配置 staticRoot → 返回 false（让上层走 404）
   */
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
}

export const IStaticFileService = createIdentifier<IStaticFileService>('web-server.static-file.service');

/**
 * 静态文件 mime 表——只列 Termlnk SPA 实际需要的类型。
 * apps/desktop/main 的 bootstrap.ts 用的是同一份契约。
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
 * Node http 静态 SPA 服务实现。
 *
 * 特性：
 * - 防 path-traversal：解析后路径必须仍在 staticRoot 内，否则 403
 * - 支持 SPA history fallback：未匹配文件 → 返回 index.html
 * - GET / HEAD 之外的方法直接返回 false（让 tRPC / 自定义 handler 处理）
 *
 * 不在 P7.1a 范围：
 * - gzip / br 压缩协商（生产建议反代层做）
 * - 长缓存 / immutable 头（apps/web/renderer 产物文件名带 hash 后再加）
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

    // 优先尝试匹配真实文件；不存在则 SPA history fallback 到 index.html
    const resolved = (await this._statFileOrFallback(filePath, root)) ?? null;
    if (!resolved) {
      // 连 index.html 都没有 → 让上层 404；不是这里的责任
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

    // SPA fallback：仅当请求不带文件后缀时走 index.html，避免把缺失的 .png 也吐 HTML
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
