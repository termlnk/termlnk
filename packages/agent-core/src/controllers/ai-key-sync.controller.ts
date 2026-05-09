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

import { IAIAgentService, ILLMProviderService } from '@termlnk/agent';
import { Disposable, ILogService } from '@termlnk/core';

// Pushes the active provider's apiKey into AIAgentService entirely within the main process,
// so the key never crosses the IPC boundary. The renderer-side controller only forwards
// model selection.
export class AIKeySyncController extends Disposable {
  constructor(
    @ILLMProviderService private readonly _providerService: ILLMProviderService,
    @IAIAgentService private readonly _aiAgentService: IAIAgentService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._initialize();
  }

  private _initialize(): void {
    this.disposeWithMe(
      this._providerService.activeProvider$.subscribe({
        next: (provider) => {
          if (provider?.apiKey) {
            this._aiAgentService.setApiKey(provider.providerId, provider.apiKey);
          }
        },
        error: (err) => {
          this._logService.error('[AIKeySyncController] activeProvider$ subscription error:', err);
        },
      })
    );
  }
}
