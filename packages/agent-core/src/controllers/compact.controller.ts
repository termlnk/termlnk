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

import type { ICompactConfig } from '@termlnk/agent';
import { IAIAgentService, normalizeCompactConfig } from '@termlnk/agent';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { debounceTime, filter, from, switchMap } from 'rxjs';
import { AGENT_CORE_PLUGIN_CONFIG_KEY } from './config.schema';

export class CompactController extends Disposable {
  constructor(
    @IAIAgentService private readonly _aiAgentService: IAIAgentService,
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._loadInitial();
    this._watchChanges();
  }

  private _loadInitial(): void {
    const sub = from(this._configRepository.getField<ICompactConfig>(AGENT_CORE_PLUGIN_CONFIG_KEY, 'compact'))
      .subscribe({
        next: (stored) => this._applyConfig(stored),
        error: (err) => this._logService.error('[CompactController] Failed to load compact config:', err),
      });
    this.disposeWithMe(sub);
  }

  private _watchChanges(): void {
    const sub = this._configRepository.changed$.pipe(
      filter((event) => event.key === AGENT_CORE_PLUGIN_CONFIG_KEY && (event.subKey === 'compact' || event.subKey === undefined)),
      debounceTime(200),
      switchMap(() => from(this._configRepository.getField<ICompactConfig>(AGENT_CORE_PLUGIN_CONFIG_KEY, 'compact')))
    ).subscribe({
      next: (stored) => this._applyConfig(stored),
      error: (err) => this._logService.error('[CompactController] Failed to reload compact config:', err),
    });
    this.disposeWithMe(sub);
  }

  private _applyConfig(stored: ICompactConfig | null | undefined): void {
    const normalized = normalizeCompactConfig(stored ?? undefined);
    this._aiAgentService.setCompactConfig(normalized);
  }
}
