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

import process from 'node:process';
import { Disposable, ILogService } from '@termlnk/core';
import { IDeepLinkRouterService } from '@termlnk/rpc-server';
import { app } from 'electron';
import { fromEvent } from 'rxjs';

const PROTOCOL = 'termlnk';
const URL_PREFIX = `${PROTOCOL}://`;

/**
 * Captures OS deep-link events (`termlnk://...`) and feeds them into the in-process
 * IDeepLinkRouterService, which dispatches each URL to the single owner registered
 * for its host (e.g. `auth` → OAuth, `invite` → the multiplayer tRPC route).
 *
 * Platform behaviour:
 *   - macOS: `app.on('open-url')` fires when an external app opens a termlnk:// URL.
 *   - Windows / Linux: the URL is passed as a command-line arg, either at first
 *     launch (process.argv) or on subsequent launches (`second-instance` argv). The
 *     SingleInstanceController already enforces single-instance + window focus, so
 *     we only need to scan argv for our scheme.
 *
 * `app.setAsDefaultProtocolClient` is best-effort — registering the protocol fails
 * silently in dev / when the binary path isn't a real installed app. The runtime
 * intake still works because the OS launcher provides the URL through one of the
 * two routes above.
 */
export class DeepLinkController extends Disposable {
  constructor(
    @IDeepLinkRouterService private readonly _router: IDeepLinkRouterService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._init();
  }

  private _init(): void {
    if (app.isReady()) {
      this._registerProtocol();
    } else {
      app.whenReady().then(() => this._registerProtocol()).catch(() => {
        // ignore — surface via the OS only
      });
    }

    // macOS path.
    this.disposeWithMe(
      fromEvent<string>(
        app,
        'open-url',
        (_event, url: string) => url
      ).subscribe((url) => this._consume(url))
    );

    // Windows / Linux: subsequent launches.
    this.disposeWithMe(
      fromEvent<readonly string[]>(
        app,
        'second-instance',
        (_event, argv: readonly string[]) => argv
      ).subscribe((argv) => {
        for (const arg of argv) {
          if (arg.startsWith(URL_PREFIX)) {
            this._consume(arg);
          }
        }
      })
    );

    // Windows / Linux: first launch with the URL in argv.
    for (const arg of process.argv) {
      if (arg.startsWith(URL_PREFIX)) {
        this._consume(arg);
      }
    }
  }

  private _registerProtocol(): void {
    try {
      const success = app.setAsDefaultProtocolClient(PROTOCOL);
      if (!success) {
        this._logService.log(`[DeepLinkController] setAsDefaultProtocolClient(${PROTOCOL}) returned false (likely dev or unprivileged binary)`);
      }
    } catch (err) {
      this._logService.error(`[DeepLinkController] setAsDefaultProtocolClient(${PROTOCOL}) threw:`, err);
    }
  }

  private _consume(url: string): void {
    this._logService.log(`[DeepLinkController] received deep link: ${url}`);
    this._router.emit(url);
  }
}
