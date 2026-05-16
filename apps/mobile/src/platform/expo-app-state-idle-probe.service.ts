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

import type { IIdleProbe } from '@termlnk/auth';
import type { AppStateStatus, NativeEventSubscription } from 'react-native';
import { Disposable } from '@termlnk/core';
import { AppState } from 'react-native';

// Mobile equivalent of Electron's powerMonitor.getSystemIdleTime. Phones have no
// system-wide "input idle" signal so we redefine idleness as "time the app has spent
// off the foreground" — when the user switches apps or locks the screen, the master
// key starts ticking towards the auto-lock threshold; coming back to the foreground
// resets the clock. This matches Termius / Blink mobile UX and Apple's HIG guidance
// for credential-bearing apps.
//
// `getIdleSeconds()` must be synchronous (IIdleProbe contract). We cache the wall-clock
// timestamp the app left the foreground and compute on demand. AppState's 'inactive'
// state (iOS only, e.g. Control Center swipe) is treated as foreground — that transient
// state lasts < 1s and locking on it would be surprising.
export class ExpoAppStateIdleProbe extends Disposable implements IIdleProbe {
  private _backgroundedAt: number | null = AppState.currentState === 'background' ? Date.now() : null;
  private readonly _subscription: NativeEventSubscription;

  constructor() {
    super();
    this._subscription = AppState.addEventListener('change', this._onAppStateChange);
  }

  override dispose(): void {
    this._subscription.remove();
    super.dispose();
  }

  getIdleSeconds(): number {
    if (this._backgroundedAt === null) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - this._backgroundedAt) / 1000));
  }

  private readonly _onAppStateChange = (next: AppStateStatus): void => {
    if (next === 'active') {
      this._backgroundedAt = null;
      return;
    }
    if (next === 'background') {
      this._backgroundedAt = Date.now();
    }
    // 'inactive' is left alone — see header comment.
  };
}
