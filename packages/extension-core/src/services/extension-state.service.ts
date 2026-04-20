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

import type { IExtensionStateService } from '@termlnk/extension';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { EXTENSION_PLUGIN_CONFIG_KEY } from '@termlnk/extension';

interface IExtensionStateData {
  disabled: string[];
  devPaths: string[];
}

const STATE_FIELD = 'extensionState';

export class ExtensionStateService extends Disposable implements IExtensionStateService {
  private _disabled = new Set<string>();
  private _devPaths = new Set<string>();
  private _loaded = false;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository
  ) {
    super();
  }

  isEnabled(extensionId: string): boolean {
    return !this._disabled.has(extensionId);
  }

  enable(extensionId: string): void {
    this._disabled.delete(extensionId);
    void this._save();
  }

  disable(extensionId: string): void {
    this._disabled.add(extensionId);
    void this._save();
  }

  getDisabledExtensions(): string[] {
    return [...this._disabled];
  }

  getDevExtensionPaths(): string[] {
    return [...this._devPaths];
  }

  addDevExtensionPath(path: string): void {
    this._devPaths.add(path);
    void this._save();
  }

  removeDevExtensionPath(path: string): void {
    this._devPaths.delete(path);
    void this._save();
  }

  async load(): Promise<void> {
    if (this._loaded) {
      return;
    }

    try {
      const data = await this._configRepository.getField<IExtensionStateData>(
        EXTENSION_PLUGIN_CONFIG_KEY,
        STATE_FIELD
      );
      if (data && Array.isArray(data.disabled)) {
        this._disabled = new Set(data.disabled);
      }
      if (data && Array.isArray(data.devPaths)) {
        this._devPaths = new Set(data.devPaths);
      }
    } catch (err) {
      this._logService.warn('[ExtensionStateService]', 'Failed to load extension state from database', err);
    }

    this._loaded = true;
  }

  async save(): Promise<void> {
    await this._save();
  }

  private async _save(): Promise<void> {
    try {
      const data: IExtensionStateData = {
        disabled: [...this._disabled],
        devPaths: [...this._devPaths],
      };
      await this._configRepository.setField(EXTENSION_PLUGIN_CONFIG_KEY, STATE_FIELD, data);
    } catch (err) {
      this._logService.error('[ExtensionStateService]', 'Failed to save extension state to database', err);
    }
  }
}
