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

import { ILogService, RxDisposable } from '@termlnk/core';
import { IAIAgentClientService, IProviderConfigService } from '@termlnk/rpc-client';
import { distinctUntilChanged, filter, takeUntil } from 'rxjs';

// Forwards model selection (providerId / modelId) to the main process when the user
// switches models. apiKey sync runs in the main process (AIKeySyncController), so the
// renderer never sees plaintext credentials.
export class AIAgentController extends RxDisposable {
  constructor(
    @IAIAgentClientService private readonly _aiAgentService: IAIAgentClientService,
    @IProviderConfigService private readonly _providerConfigService: IProviderConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._setupModelSync();
  }

  private _setupModelSync(): void {
    this._providerConfigService.activeModel$.pipe(
      filter((model): model is NonNullable<typeof model> => model !== null),
      distinctUntilChanged((prev, next) => prev.id === next.id),
      takeUntil(this.dispose$)
    ).subscribe((model) => {
      // Composite model id is `providerId/modelId`; modelId may itself contain '/'.
      const [providerId, ...rest] = model.id.split('/');
      const modelId = rest.join('/');
      this._aiAgentService.setModel(providerId, modelId).catch((err) => {
        this._logService.error('[AIAgentController] setModel failed:', err);
      });
    });
  }
}
