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

import { Disposable, ILogService, Inject } from '@termlnk/core';
import { IMasterKeyHolderService } from '../services/master-key-holder.service';
import { IWebServerService } from '../services/web-server.service';
import { IWebSessionService } from '../services/web-session.service';
import { createAuthRouteHandler } from '../trpc/auth-routes';
import { TERMLNK_WEB_AUTH_PATH_PREFIX } from './config.schema';

/**
 * Wires the master-key holder + session service + auth route handler into the
 * server lifecycle.
 *
 * Order on plugin onReady:
 *   1. Mount the auth handler under TERMLNK_WEB_AUTH_PATH_PREFIX so it short-
 *      circuits before the tRPC dispatcher even when the holder is still
 *      pending (so login UI loads even before the master password is sourced).
 *   2. Trigger holder initialization (Argon2id can take ~250ms — we do not
 *      block plugin.onReady on it; the server starts in `pending` state and
 *      tRPC procedures must guard with `getMasterKey()` calls).
 *
 * Failure of holder initialization flips state to 'error' but does NOT abort
 * the plugin chain — the auth `/status` endpoint still serves a clear error,
 * and the deployer can fix the env source and restart without rebuilding.
 */
export class AuthController extends Disposable {
  constructor(
    @Inject(IWebServerService) private readonly _webServerService: IWebServerService,
    @Inject(IMasterKeyHolderService) private readonly _masterKeyHolder: IMasterKeyHolderService,
    @Inject(IWebSessionService) private readonly _sessionService: IWebSessionService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  mountAndInit(): void {
    const handler = createAuthRouteHandler({
      masterKeyHolder: this._masterKeyHolder,
      sessionService: this._sessionService,
      logService: this._logService,
    });
    this._webServerService.mountRouteHandler(TERMLNK_WEB_AUTH_PATH_PREFIX, handler);

    // Fire-and-forget — holder.state$ surfaces the result; plugin.onReady
    // does not block on Argon2id (~64MiB / 3 iters / 4 lanes ≈ 250ms).
    void this._masterKeyHolder.initialize().catch((err) => {
      this._logService.error(
        `[AuthController] master key holder init failed: ${err instanceof Error ? err.message : String(err)}`
      );
    });
  }
}
