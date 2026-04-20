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

import { exec } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentifier, Disposable, IConfigService, ILogService } from '@termlnk/core';
import { EXTENSIONS_DIR_NAME } from '@termlnk/extension';
import { resolveConfigPath } from '@termlnk/rpc';

export interface IExtensionInstallService {
  npmInstall(packageName: string, version: string, extensionId: string): Promise<{ path: string }>;
  removeExtension(extensionId: string): Promise<void>;
  showOpenDirectoryDialog(title?: string): Promise<{ canceled: boolean; path: string | null }>;
}

export const IExtensionInstallService = createIdentifier<IExtensionInstallService>('extension-core.install-service');

export class ExtensionInstallService extends Disposable implements IExtensionInstallService {
  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
  }

  async npmInstall(packageName: string, version: string, extensionId: string): Promise<{ path: string }> {
    const extensionsDir = this._getExtensionsDir();
    const targetDir = join(extensionsDir, extensionId);

    mkdirSync(extensionsDir, { recursive: true });

    const tmpDir = join(tmpdir(), `termlnk-ext-install-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    try {
      writeFileSync(
        join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'termlnk-ext-install', version: '0.0.0', private: true })
      );

      const npmPkg = `${packageName}@${version}`;
      await new Promise<void>((resolve, reject) => {
        exec(
          `npm install ${npmPkg} --no-save --prefix "${tmpDir}"`,
          { timeout: 120_000 },
          (error, _stdout, stderr) => {
            if (error) {
              reject(new Error(`npm install failed: ${stderr || error.message}`));
            } else {
              resolve();
            }
          }
        );
      });

      const installedPath = join(tmpDir, 'node_modules', packageName);
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
      cpSync(installedPath, targetDir, { recursive: true });

      this._logService.log('[ExtensionInstallService]', `Installed ${npmPkg} to ${targetDir}`);
      return { path: targetDir };
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  async removeExtension(extensionId: string): Promise<void> {
    const targetDir = join(this._getExtensionsDir(), extensionId);
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
      this._logService.log('[ExtensionInstallService]', `Removed extension: ${extensionId}`);
    }
  }

  async showOpenDirectoryDialog(title?: string): Promise<{ canceled: boolean; path: string | null }> {
    // This will be called via the injector which provides IFileDialogService at runtime
    // For now, return a stub — the actual implementation is wired via the tRPC router
    // which has access to IFileDialogService from electron-main
    return { canceled: true, path: null };
  }

  private _getExtensionsDir(): string {
    return join(resolveConfigPath(this._configService), EXTENSIONS_DIR_NAME);
  }
}
