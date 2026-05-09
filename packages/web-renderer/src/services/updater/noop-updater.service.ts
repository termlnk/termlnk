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

import type { IUpdateError, IUpdateInfo, IUpdateProgress, IUpdaterService } from '@termlnk/electron';
import type { Observable } from 'rxjs';
import { UpdateStatus } from '@termlnk/electron';
import { NEVER, of } from 'rxjs';

/**
 * No-op IUpdaterService for browser deployments.
 *
 * termlnk-web ships as a server process the deployer pulls via docker / pkg
 * — there's no in-app updater. Status is permanently `IDLE`; check / download
 * / install resolve immediately without action. UI plugins that subscribe to
 * `status$` see one IDLE emission and nothing further; those reading
 * `getCurrentVersion()` get the build-time `__APP_VERSION__` if injected,
 * otherwise the literal `0.0.0` so the call shape is stable.
 *
 * apps/web/renderer is expected to NOT register UpdaterUIPlugin in its plugin
 * chain, so this no-op is a defensive fallback rather than the primary user-
 * facing surface.
 */
export class NoopUpdaterService implements IUpdaterService {
  readonly status$: Observable<UpdateStatus> = of(UpdateStatus.IDLE);
  readonly updateInfo$: Observable<IUpdateInfo | null> = of(null);
  readonly progress$: Observable<IUpdateProgress> = NEVER;
  readonly error$: Observable<IUpdateError> = NEVER;

  async getCurrentVersion(): Promise<string> {
    return readWebAppVersion();
  }

  async getStatus(): Promise<UpdateStatus> {
    return UpdateStatus.IDLE;
  }

  async checkForUpdates(): Promise<IUpdateInfo | null> {
    return null;
  }

  async downloadUpdate(): Promise<void> {}

  async quitAndInstall(_isSilent?: boolean, _isForceRunAfter?: boolean): Promise<void> {}
}

/**
 * Reach into the build-time injected `__APP_VERSION__` (Vite `define`) when
 * available; fall back to a stable placeholder otherwise so callers never
 * crash on version comparisons.
 */
function readWebAppVersion(): string {
  const fromBuild = (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__;
  return typeof fromBuild === 'string' && fromBuild.length > 0 ? fromBuild : '0.0.0';
}
