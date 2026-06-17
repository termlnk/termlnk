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

import type { IGoogleSignInLauncher } from '@termlnk/auth';
import { IAuthService } from '@termlnk/auth';
import { Disposable } from '@termlnk/core';

// The preload bridge that opens URLs in the OS browser. Typed locally to avoid a
// hard dependency on the preload's full surface; only present in the Electron shell.
interface INativeShell {
  openExternal: (url: string) => void;
}

/**
 * Electron implementation of the Google sign-in launcher: open the authorize URL
 * in the OS browser and let the `termlnk://auth/callback` deep link drive
 * loginWithGoogle in the main process. There is nothing to await here — sign-in
 * completion surfaces through IAuthService.authState$.
 */
export class ElectronGoogleSignInLauncher extends Disposable implements IGoogleSignInLauncher {
  constructor(
    @IAuthService private readonly _authService: IAuthService
  ) {
    super();
  }

  async launch(): Promise<void> {
    const authorizeUrl = await this._authService.getGoogleAuthorizeUrl();
    const nativeShell = (window as unknown as { nativeShell?: INativeShell }).nativeShell;
    nativeShell?.openExternal(authorizeUrl);
  }
}
