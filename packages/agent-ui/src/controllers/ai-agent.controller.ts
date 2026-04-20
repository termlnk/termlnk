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

import { RxDisposable } from '@termlnk/core';
import { IAIAgentClientService, IProviderConfigClientService } from '@termlnk/rpc-client';
import { combineLatest, distinctUntilChanged, filter } from 'rxjs';

export class AIAgentController extends RxDisposable {
  constructor(
    @IAIAgentClientService private readonly _aiAgentService: IAIAgentClientService,
    @IProviderConfigClientService private readonly _providerConfigService: IProviderConfigClientService
  ) {
    super();

    this._setupModelSync();
  }

  private _setupModelSync(): void {
    const sub = combineLatest([
      this._providerConfigService.activeModel$,
      this._providerConfigService.activeProvider$,
    ]).pipe(
      filter(([model]) => model !== null),
      distinctUntilChanged(
        ([prevModel, prevProvider], [nextModel, nextProvider]) =>
          prevModel?.id === nextModel?.id
          && prevProvider?.apiKey === nextProvider?.apiKey
          && prevProvider?.baseUrl === nextProvider?.baseUrl
      )
    ).subscribe(([model, providerConfig]) => {
      if (!model) return;

      // Set model on agent — extract provider and model ID from composite "provider/modelId"
      const parts = model.id.split('/');
      const providerId = parts[0];
      const modelId = parts.slice(1).join('/');
      this._aiAgentService.setModel(providerId, modelId).catch((err) => {
        console.error('[AIAgentController] setModel failed:', err);
      });

      // Set API key if available
      if (providerConfig?.apiKey) {
        this._aiAgentService.setApiKey(providerId, providerConfig.apiKey).catch((err) => {
          console.error('[AIAgentController] setApiKey failed:', err);
        });
      }
    });

    this.disposeWithMe({ dispose: () => sub.unsubscribe() });
  }
}
