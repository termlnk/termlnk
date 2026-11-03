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

import type { IAgentCorePluginConfig } from './config.schema';
import { homedir } from 'node:os';
import process from 'node:process';
import { Disposable, IConfigService, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { AGENT_CORE_PLUGIN_CONFIG_KEY } from './config.schema';
import { cleanupLegacyAgentHooks } from './legacy-agent-hook-cleanup';

const CLEANUP_DONE_FIELD = 'legacyAgentHookCleanupDone';

// TEMPORARY: remove together with ./legacy-agent-hook-cleanup once users have migrated.
export class LegacyAgentHookCleanupController extends Disposable {
  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    void this._run().catch((err) => {
      this._logService.warn('[LegacyAgentHookCleanup]', 'Cleanup failed:', err);
    });
  }

  private async _run(): Promise<void> {
    const done = await this._configRepository.getField<boolean>(AGENT_CORE_PLUGIN_CONFIG_KEY, CLEANUP_DONE_FIELD);
    if (done === true) {
      return;
    }

    const config = this._configService.getConfig<IAgentCorePluginConfig>(AGENT_CORE_PLUGIN_CONFIG_KEY);
    const succeeded = cleanupLegacyAgentHooks({
      homeDir: homedir(),
      configPath: config?.configPath,
      env: process.env,
      logService: this._logService,
    });
    if (!succeeded) {
      return;
    }

    await this._configRepository.setField(AGENT_CORE_PLUGIN_CONFIG_KEY, CLEANUP_DONE_FIELD, true);
  }
}
