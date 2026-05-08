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

/**
 * 主进程内部 controller：当活跃 provider 变化时自动把 apiKey 推给 AIAgentService。
 *
 * 第一性原理：apiKey 已经在主进程内（ProviderRepository / LLMProviderService），
 * 没必要绕到渲染端再 RPC 推回主进程。这条路径以前因为 AIAgentController（渲染端）
 * 订阅 activeProvider$ 后调 setApiKey RPC，造成 apiKey 跨 IPC 边界两次（出 + 回）。
 *
 * 此 controller 取代那条路径——activeProvider$ 在主进程内被订阅，apiKey 永不出主进程。
 * tRPC ai 路由层把 activeProvider$ 脱敏（去除 apiKey 字段），渲染端只需关心模型选择。
 */
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
