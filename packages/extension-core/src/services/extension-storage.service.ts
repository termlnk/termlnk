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

import type { IExtensionDescription, IExtensionStateService, IExtensionStorageService } from '@termlnk/extension';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Disposable, IConfigService, ILogService } from '@termlnk/core';
import { EXTENSIONS_DIR_NAME, ExtensionStatus, IExtensionStateService as IExtensionStateServiceId, validateManifest } from '@termlnk/extension';
import { resolveConfigPath } from '@termlnk/rpc';

export class ExtensionStorageService extends Disposable implements IExtensionStorageService {
  private readonly _extensionDirCache = new Map<string, string>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @IExtensionStateServiceId private readonly _stateService: IExtensionStateService
  ) {
    super();
  }

  async scanExtensions(): Promise<IExtensionDescription[]> {
    const extensionsDir = join(resolveConfigPath(this._configService), EXTENSIONS_DIR_NAME);
    const descriptions: IExtensionDescription[] = [];

    if (!existsSync(extensionsDir)) {
      return descriptions;
    }

    try {
      const entries = readdirSync(extensionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const extPath = join(extensionsDir, entry.name);
        const manifestPath = join(extPath, 'manifest.json');

        if (!existsSync(manifestPath)) {
          this._logService.warn('[ExtensionStorageService]', `No manifest.json found in extension directory: ${entry.name}`);
          continue;
        }

        try {
          const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const manifest = validateManifest(raw);
          descriptions.push({
            id: manifest.id,
            extensionPath: extPath,
            manifest,
            status: ExtensionStatus.Discovered,
          });
          this._extensionDirCache.set(manifest.id, extPath);
        } catch (err) {
          this._logService.warn('[ExtensionStorageService]', `Invalid manifest in extension: ${entry.name}`, err);
        }
      }
    } catch (err) {
      this._logService.error('[ExtensionStorageService]', 'Failed to scan extensions directory', err);
    }

    return descriptions;
  }

  async scanLocalExtension(absolutePath: string): Promise<IExtensionDescription> {
    const resolvedPath = resolve(absolutePath);
    const stat = statSync(resolvedPath);

    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    const manifestPath = join(resolvedPath, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`No manifest.json found in: ${resolvedPath}`);
    }

    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const manifest = validateManifest(raw);
    this._extensionDirCache.set(manifest.id, resolvedPath);

    return {
      id: manifest.id,
      extensionPath: resolvedPath,
      manifest,
      status: ExtensionStatus.Discovered,
      isDev: true,
    };
  }

  readExtensionFile(extensionId: string, filePath: string): string {
    const resolvedPath = this.resolveExtensionFilePath(extensionId, filePath);
    if (!resolvedPath) {
      throw new Error(`Extension file not found: ${extensionId}/${filePath}`);
    }
    return readFileSync(resolvedPath, 'utf-8');
  }

  resolveExtensionFilePath(extensionId: string, filePath: string): string | null {
    const extensionDir = this._resolveExtensionDir(extensionId);
    if (!extensionDir) {
      return null;
    }
    const resolvedPath = resolve(extensionDir, filePath);
    if (!resolvedPath.startsWith(extensionDir)) {
      return null;
    }
    if (!existsSync(resolvedPath)) {
      return null;
    }
    return resolvedPath;
  }

  private _resolveExtensionDir(extensionId: string): string | null {
    const cached = this._extensionDirCache.get(extensionId);
    if (cached && existsSync(cached)) {
      return cached;
    }

    const installedDir = join(resolveConfigPath(this._configService), EXTENSIONS_DIR_NAME, extensionId);
    if (existsSync(installedDir)) {
      this._extensionDirCache.set(extensionId, installedDir);
      return installedDir;
    }

    for (const devPath of this._stateService.getDevExtensionPaths()) {
      const manifestPath = join(devPath, 'manifest.json');
      if (!existsSync(manifestPath)) {
        continue;
      }
      try {
        const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        if (raw?.id === extensionId) {
          const resolved = resolve(devPath);
          this._extensionDirCache.set(extensionId, resolved);
          return resolved;
        }
      } catch (err) {
        this._logService.debug('[ExtensionStorageService]', `Failed to read manifest at dev path ${devPath}`, err);
      }
    }

    return null;
  }
}
