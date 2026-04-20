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

import type { Platform } from '@termlnk/core';
import { mkdir } from 'node:fs/promises';
import { createIdentifier, Disposable, IConfigService, platform } from '@termlnk/core';
import { resolveConfigPath } from '@termlnk/rpc';

export interface IPlatformService {
  /** Get app data root directory (configPath) */
  getAppDataPath(): string;

  /** Ensure directory exists */
  ensureDir(path: string): Promise<void>;

  getPlatform(): Platform;
}

export const IPlatformService = createIdentifier<IPlatformService>('electron-main.platform-service');

export class PlatformService extends Disposable implements IPlatformService {
  private readonly _appDataPath: string;

  constructor(
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    this._appDataPath = resolveConfigPath(this._configService);
  }

  getPlatform(): Platform {
    return platform;
  }

  getAppDataPath(): string {
    return this._appDataPath;
  }

  async ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }
}
