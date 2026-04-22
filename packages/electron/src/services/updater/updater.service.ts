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
import { createIdentifier } from '@termlnk/core';

export interface IUpdaterService {
  status$: Observable<UpdateStatus>;
  /**
   * Latest known update info, or null when no update has been discovered yet.
   * Emits the current value immediately on subscribe so late subscribers
   * (e.g. a dialog opened in response to status=AVAILABLE) don't miss it.
   */
  updateInfo$: Observable<IUpdateInfo | null>;
  progress$: Observable<IUpdateProgress>;
  error$: Observable<IUpdateError>;

  getCurrentVersion(): Promise<string>;
  getStatus(): Promise<UpdateStatus>;
  checkForUpdates(): Promise<IUpdateInfo | null>;
  downloadUpdate(): Promise<void>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export const IUpdaterService = createIdentifier<IUpdaterService>('electron.updater-service');
