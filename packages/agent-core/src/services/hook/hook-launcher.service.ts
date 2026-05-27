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

import type { IHookLauncherService } from '@termlnk/agent';
import type { IAgentCorePluginConfig } from '../../controllers/config.schema';
import { accessSync, chmodSync, copyFileSync, existsSync, constants as fsConstants, mkdirSync, statSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';
import { Disposable, IConfigService, ILogService } from '@termlnk/core';
import { AGENT_CORE_PLUGIN_CONFIG_KEY } from '../../controllers/config.schema';

const BIN_DIR_NAME = 'bin';
const HELPER_FILE = 'hook-helper.js';
const POSIX_LAUNCHER_FILE = 'termlnk-hook';
const WIN_LAUNCHER_FILE = 'termlnk-hook.cmd';

/**
 * Default implementation of {@link IHookLauncherService}.
 *
 * Copies launcher scripts + helper from the app-bundled `agent-hook-cli`
 * source directory into `<configPath>/bin/` at startup, overwriting any
 * prior version. The POSIX launcher script is chmod'd to 0755 after copying
 * so external agents can execute it directly. The helper (`hook-helper.js`)
 * is not marked executable — it is invoked via `node`, not directly.
 *
 * `configPath` is the shared Termlnk config root (e.g.
 * `~/.config/termlnk` on POSIX), resolved by desktop main and passed in via
 * `IAgentCorePluginConfig.configPath`.
 */
export class HookLauncherService extends Disposable implements IHookLauncherService {
  private _available = false;
  private readonly _isWindows = platform() === 'win32';

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  getLauncherPath(): string {
    const binDir = this._resolveBinDir();
    return join(binDir, this._isWindows ? WIN_LAUNCHER_FILE : POSIX_LAUNCHER_FILE);
  }

  isAvailable(): boolean {
    return this._available;
  }

  async install(): Promise<boolean> {
    const config = this._configService.getConfig<IAgentCorePluginConfig>(AGENT_CORE_PLUGIN_CONFIG_KEY);
    const configPath = config?.configPath;
    const hookCliSrcDir = config?.hookCliSrcDir;

    if (!configPath) {
      this._logService.warn('[HookLauncherService]', 'No configPath configured; external-terminal hook support disabled');
      this._available = false;
      return false;
    }
    if (!hookCliSrcDir) {
      this._logService.warn('[HookLauncherService]', 'No hookCliSrcDir configured; external-terminal hook support disabled');
      this._available = false;
      return false;
    }
    if (!existsSync(hookCliSrcDir)) {
      this._logService.warn(
        '[HookLauncherService]',
        `Source dir ${hookCliSrcDir} does not exist; external-terminal hook support disabled`
      );
      this._available = false;
      return false;
    }

    try {
      const binDir = this._resolveBinDir();
      mkdirSync(binDir, { recursive: true, mode: 0o755 });

      // Install both launcher variants so a future OS change (e.g., WSL to
      // native) does not leave stale files behind; the helper is shared by both.
      this._installFile(POSIX_LAUNCHER_FILE, 'launcher.sh', binDir, true);
      this._installFile(WIN_LAUNCHER_FILE, 'launcher.cmd', binDir, false);
      this._installFile(HELPER_FILE, 'helper.js', binDir, false);

      this._available = true;
      this._logService.log('[HookLauncherService]', `Installed launcher to ${binDir}`);
      return true;
    } catch (err) {
      this._logService.warn('[HookLauncherService]', 'Install failed:', err);
      this._available = false;
      return false;
    }
  }

  private _resolveBinDir(): string {
    const config = this._configService.getConfig<IAgentCorePluginConfig>(AGENT_CORE_PLUGIN_CONFIG_KEY);
    return join(config!.configPath!, BIN_DIR_NAME);
  }

  private _installFile(destName: string, srcName: string, binDir: string, executable: boolean): void {
    const config = this._configService.getConfig<IAgentCorePluginConfig>(AGENT_CORE_PLUGIN_CONFIG_KEY);

    const src = join(config!.hookCliSrcDir!, srcName);
    const dest = join(binDir, destName);
    if (this._shouldOverwrite(src, dest)) {
      copyFileSync(src, dest);
    }
    if (executable) {
      try {
        chmodSync(dest, 0o755);
      } catch {
        // Best-effort: Windows ignores chmod, and POSIX may not grant us perms.
      }
    }
  }

  /**
   * Skip the copy when the destination already matches the source (by size
   * and mtime). Avoids needless writes on every app restart, which would
   * otherwise make file-watching tools flap.
   */
  private _shouldOverwrite(src: string, dest: string): boolean {
    try {
      accessSync(dest, fsConstants.F_OK);
    } catch {
      return true;
    }
    try {
      const srcStat = statSync(src);
      const destStat = statSync(dest);
      if (srcStat.size !== destStat.size) {
        return true;
      }
      return srcStat.mtimeMs > destStat.mtimeMs;
    } catch {
      return true;
    }
  }
}
