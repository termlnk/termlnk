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
import { ConfigRepository } from '@termlnk/database';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { IWebServerService } from '../services/web-server.service';

const BOOT_CONFIG_PATH = '/boot/ui-config';

/**
 * Serves the persisted `ui.config` row as JSON so the SPA can pick the initial
 * theme (mode + dark/light slots) before Core is constructed. Mirrors the
 * Electron preload IPC channel `termlnk:boot-ui-config` — same purpose, same
 * response shape, different transport.
 *
 * Unauthenticated by design: the payload is purely UI preference (mode + theme
 * names), no secrets. Keeps the login page rendering under the user's chosen
 * mode even before the session cookie exists.
 */
export class BootConfigController extends Disposable {
  constructor(
    @Inject(IWebServerService) private readonly _webServerService: IWebServerService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  mount(): void {
    this._webServerService.mountRouteHandler(BOOT_CONFIG_PATH, async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
      if (req.method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Method Not Allowed');
        return true;
      }

      try {
        const config = await this._configRepository.get('ui.config');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(config ?? null));
      } catch (err) {
        this._logService.error(`[BootConfigController] read ui.config failed: ${err instanceof Error ? err.stack : String(err)}`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end('null');
      }
      return true;
    });
  }
}
