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

// Mounts the auth handler so the login UI loads even while the holder is still pending,
// then fires holder.initialize() without blocking onReady. Holder failures flip the
// state machine but never abort the plugin chain.
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
