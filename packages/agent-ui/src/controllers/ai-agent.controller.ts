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
import { distinctUntilChanged, filter } from 'rxjs';

/**
 * 渲染端 AI 控制器：当用户切换模型时，把 (providerId, modelId) 推给主进程。
 *
 * apiKey 同步**不再由渲染端负责**——主进程的 AIKeySyncController 直接订阅
 * activeProvider$ 内部完成；本 controller 仅传递模型选择。这让 apiKey 永不
 * 跨过 IPC 边界，配合 ai 路由的 sanitize 实现"渲染端零明文凭据"。
 */
export class AIAgentController extends RxDisposable {
  constructor(
    @IAIAgentClientService private readonly _aiAgentService: IAIAgentClientService,
    @IProviderConfigClientService private readonly _providerConfigService: IProviderConfigClientService
  ) {
    super();

    this._setupModelSync();
  }

  private _setupModelSync(): void {
    const sub = this._providerConfigService.activeModel$.pipe(
      filter((model) => model !== null),
      distinctUntilChanged((prev, next) => prev?.id === next?.id)
    ).subscribe((model) => {
      if (!model) {
        return;
      }
      // 模型 ID 形如 "provider/modelId"
      const parts = model.id.split('/');
      const providerId = parts[0];
      const modelId = parts.slice(1).join('/');
      this._aiAgentService.setModel(providerId, modelId).catch((err) => {
        console.error('[AIAgentController] setModel failed:', err);
      });
    });

    this.disposeWithMe({ dispose: () => sub.unsubscribe() });
  }
}
