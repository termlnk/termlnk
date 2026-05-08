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

import type { IPokeMessage, IPullRequest, IPullResponse, IPushRequest, IPushResponse, ISyncTransportService } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * 占位 transport——connect 一直处于"未连接"状态；push/pull 返回空响应。
 *
 * 用途：Phase 3 网络层落地前，SyncCorePlugin 注册一个可用的 transport binding，
 * 让 SyncService 能正常 enable（而不是因 DI 缺失抛错）。enable() 后 state$
 * 立即变 Offline，UI 显示"未连接"——用户主动登录 / 配置后端后由 desktop main
 * 的 override 替换为真实 HTTP/WS 实现。
 */
export class NoopSyncTransportService extends Disposable implements ISyncTransportService {
  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _poke$ = new Subject<IPokeMessage>();
  readonly poke$: Observable<IPokeMessage> = this._poke$.asObservable();

  override dispose(): void {
    this._connected$.complete();
    this._poke$.complete();
    super.dispose();
  }

  async push(_req: IPushRequest): Promise<IPushResponse> {
    throw new Error('[NoopSyncTransportService] cloud transport is not configured; sync push is unavailable');
  }

  async pull(_req: IPullRequest): Promise<IPullResponse> {
    throw new Error('[NoopSyncTransportService] cloud transport is not configured; sync pull is unavailable');
  }

  async connect(): Promise<void> {
    // 不抛错，但保持 connected=false——SyncService 进入 Offline 状态
  }

  async disconnect(): Promise<void> {
    this._connected$.next(false);
  }
}
