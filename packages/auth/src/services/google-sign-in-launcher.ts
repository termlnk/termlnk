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

import { createIdentifier } from '@termlnk/core';

/**
 * Renderer-side launcher for the Google sign-in flow. The flow's tail differs
 * per shell — Electron opens the system browser and waits for a `termlnk://`
 * deep link, while the browser shell opens a popup and polls the relay
 * out-of-band — so each shell registers its own implementation and the shared
 * UI (AuthGate) only depends on this interface, never on shell specifics.
 *
 * `launch()` runs the whole flow to completion; sign-in success surfaces through
 * `IAuthService.authState$` as usual, so callers don't await a result here.
 */
export interface IGoogleSignInLauncher {
  launch(): Promise<void>;
}

export const IGoogleSignInLauncher = createIdentifier<IGoogleSignInLauncher>('auth.google-sign-in-launcher');
