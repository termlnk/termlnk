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

import { ISkillDiscoveryService, ISkillStateService } from '@termlnk/agent';
import { Disposable, ILogService } from '@termlnk/core';

export class SkillController extends Disposable {
  constructor(
    @ILogService private readonly _logService: ILogService,
    @ISkillDiscoveryService private readonly _discoveryService: ISkillDiscoveryService,
    @ISkillStateService private readonly _stateService: ISkillStateService
  ) {
    super();
    this._initialize();
  }

  private async _initialize(): Promise<void> {
    try {
      // Discover and refresh state
      // Bundled skills sync is handled by bootstrap before plugin init
      await this._stateService.refresh();

      this._logService.log('[SkillController] Skill system initialized');
    } catch (err) {
      this._logService.error(`[SkillController] Failed to initialize: ${err}`);
    }
  }
}
