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

import type { GoogleWebSignInStatus, IGoogleSignInLauncher } from '@termlnk/auth';
import { IAuthService } from '@termlnk/auth';
import { Disposable, ILogService } from '@termlnk/core';

const POPUP_FEATURES = 'popup=yes,width=480,height=720';
const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 5 * 60 * 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Web implementation of the Google sign-in launcher. The browser can't receive a
 * `termlnk://` deep link and its domain can't be registered with Google, so the
 * relay code is delivered out-of-band: open the authorize URL in a popup, then
 * poll the BFF (which polls our server by device code) until the session is
 * claimed in place. Sign-in completion surfaces through IAuthService.authState$.
 */
export class WebGoogleSignInLauncher extends Disposable implements IGoogleSignInLauncher {
  private _cancelled = false;

  constructor(
    @IAuthService private readonly _authService: IAuthService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async launch(): Promise<void> {
    // Open the popup synchronously while still inside the click gesture, then
    // navigate it once beginGoogleWebSignIn resolves. Opening it after the await
    // (outside the gesture) is what popup blockers reject — notably on Safari.
    const popup = window.open('', 'termlnk-google-signin', POPUP_FEATURES);
    if (!popup) {
      throw new Error('Could not open the Google sign-in window. Allow popups for this site and try again.');
    }

    let authorizeUrl: string;
    try {
      ({ authorizeUrl } = await this._authService.beginGoogleWebSignIn());
    } catch (err) {
      popup.close();
      throw err;
    }
    popup.location.href = authorizeUrl;

    const deadline = Date.now() + MAX_WAIT_MS;
    while (!this._cancelled && Date.now() < deadline) {
      await delay(POLL_INTERVAL_MS);
      if (this._cancelled) {
        return;
      }
      let status: GoogleWebSignInStatus;
      try {
        status = await this._authService.pollGoogleWebSignIn();
      } catch (err) {
        this._logService.warn('[WebGoogleSignInLauncher] poll failed, retrying:', err);
        continue;
      }
      if (status === 'complete' || status === 'expired' || status === 'error') {
        // 'error' already surfaced the reason via authState$/lastError$; just stop.
        popup.close();
        return;
      }
      // status === 'pending': if the user closed the popup before finishing, stop.
      if (popup.closed) {
        this._logService.log('[WebGoogleSignInLauncher] popup closed before completion');
        return;
      }
    }
    popup.close();
    // Hitting the deadline (rather than a cancel or a user-closed popup) means the
    // sign-in never completed — surface it so AuthGate reports an error instead of
    // silently leaving the user at the sign-in form.
    if (!this._cancelled) {
      throw new Error('Google sign-in timed out. Please try again.');
    }
  }

  override dispose(): void {
    super.dispose();
    this._cancelled = true;
  }
}
