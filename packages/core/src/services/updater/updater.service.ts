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

import type { Observable } from 'rxjs';
import type { IUpdateError, IUpdateInfo, IUpdateProgress, UpdateStatus } from './type';
import { createIdentifier } from '../../common/di';

/**
 * IUpdaterService — host-agnostic application update contract.
 *
 * Lives in @termlnk/core because both main and renderer processes consume it:
 * the main process owns the concrete implementation (e.g. electron-updater on
 * desktop, GitHub Releases poll on web-server), while renderers either expose
 * it across IPC (desktop) or run it in-process (web SPA).
 *
 * UI components (in @termlnk/ui) consume only this token and adjust their
 * action surface via IHostEnvironmentService — they never branch on the
 * concrete implementation class.
 */
export interface IUpdaterService {
  status$: Observable<UpdateStatus>;
  /**
   * Latest known update info, or null when no update has been discovered yet.
   * Should emit the current value immediately on subscribe so late subscribers
   * (e.g. a dialog opened in response to status=AVAILABLE) don't miss it.
   */
  updateInfo$: Observable<IUpdateInfo | null>;
  progress$: Observable<IUpdateProgress>;
  error$: Observable<IUpdateError>;

  getCurrentVersion(): Promise<string>;
  getStatus(): Promise<UpdateStatus>;
  checkForUpdates(): Promise<IUpdateInfo | null>;
  /** May reject with NOT_SUPPORTED on shells that don't ship in-app installers. */
  downloadUpdate(): Promise<void>;
  /** May reject with NOT_SUPPORTED on shells that don't ship in-app installers. */
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): Promise<void>;
}

export const IUpdaterService = createIdentifier<IUpdaterService>('core.updater-service');
