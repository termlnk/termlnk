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

import { IAuthService } from '@termlnk/auth';
import { Disposable, ILogService, Inject, Injector, Quantity } from '@termlnk/core';
import { IDeepLinkBus } from '@termlnk/rpc-server';

const URL_PREFIX = 'termlnk://';

/**
 * Bridges OAuth deep links to the main-process auth service. The Google browser
 * flow ends with a 302 to `termlnk://auth/callback?relayCode=…` (or `?error=…`),
 * captured by DeepLinkController and re-emitted on IDeepLinkBus. We filter those
 * URLs and drive `IAuthService.loginWithGoogle` with the one-time relay code.
 *
 * IAuthService is resolved lazily (Quantity.OPTIONAL) per callback rather than
 * injected once: it is unbound without `cloudBaseUrl`, and resolving late avoids
 * coupling this controller's construction order to AuthCorePlugin's.
 */
export class OAuthController extends Disposable {
  constructor(
    @IDeepLinkBus private readonly _bus: IDeepLinkBus,
    @ILogService private readonly _logService: ILogService,
    @Inject(Injector) private readonly _injector: Injector
  ) {
    super();
    this.disposeWithMe(
      this._bus.url$.subscribe((url) => this._handle(url))
    );
  }

  private _handle(url: string): void {
    if (!url.startsWith(URL_PREFIX)) {
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    // termlnk://auth/callback?relayCode=… — host is 'auth', pathname '/callback'.
    if (parsed.hostname !== 'auth' || parsed.pathname !== '/callback') {
      return;
    }
    const error = parsed.searchParams.get('error');
    if (error) {
      this._logService.warn(`[OAuthController] google sign-in failed: ${error}`);
      return;
    }
    const relayCode = parsed.searchParams.get('relayCode');
    if (!relayCode) {
      return;
    }
    const authService = this._injector.get(IAuthService, Quantity.OPTIONAL);
    if (!authService) {
      this._logService.warn('[OAuthController] received OAuth callback but cloud auth is not configured');
      return;
    }
    void authService.loginWithGoogle(relayCode).catch((err) => {
      this._logService.warn('[OAuthController] loginWithGoogle failed:', err);
    });
  }
}
