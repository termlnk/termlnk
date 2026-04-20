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
import { IConfigManagerService } from '@termlnk/rpc-client';

const STORAGE_KEY = 'terminal-ui.last-local-cwd';

export interface ILastCwdService {
  getLastCwd(): Promise<string>;
  setLastCwd(cwd: string): Promise<void>;
}

export const ILastCwdService = createIdentifier<ILastCwdService>('terminal-ui.last-cwd-service');

export class LastCwdService implements ILastCwdService {
  private _lastCwd = '';
  private readonly _initPromise: Promise<void>;

  constructor(
    @IConfigManagerService private readonly _configManager: IConfigManagerService
  ) {
    this._initPromise = this._configManager.get<string>(STORAGE_KEY).then((value) => {
      if (value) {
        this._lastCwd = value;
      }
    });
  }

  async getLastCwd(): Promise<string> {
    await this._initPromise;
    return this._lastCwd;
  }

  async setLastCwd(cwd: string): Promise<void> {
    this._lastCwd = cwd;
    await this._configManager.set(STORAGE_KEY, cwd);
  }
}
