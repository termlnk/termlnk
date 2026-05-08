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

import type { Observable } from 'rxjs';
import type { ISyncError, ISyncStats, SyncState } from '../models/state';
import { createIdentifier } from '@termlnk/core';

/**
 * 同步引擎协调器（**仅主进程**）。
 *
 * 职责：
 * - 注册 / 销毁 ResourceSynchroniser
 * - 管理全局同步生命周期（启用 / 禁用）
 * - 触发 push/pull 节奏（debounce / 轮询 / poke 唤醒）
 * - 暴露 sync state 给渲染端订阅（经 tRPC subscription 透传）
 *
 * 不做的事：
 * - 不直接解密 payload（IResourceSynchroniser 自行处理）
 * - 不处理 SQLite 数据合并（IResourceSynchroniser 用 Repository 完成）
 * - 不管理 token（IAuthService 负责；SyncTransportService 通过拦截器附加）
 */
export interface ISyncService {
  readonly state$: Observable<SyncState>;
  readonly stats$: Observable<ISyncStats>;
  readonly lastError$: Observable<ISyncError | null>;

  /** 同步是否当前启用（用户已登录 + 已选择启用同步） */
  readonly enabled$: Observable<boolean>;

  /**
   * 启用同步：
   * 1. 检查 IAuthService 已登录
   * 2. 检查 IMasterKeyService 已 unlocked
   * 3. 注册所有 ResourceSynchroniser
   * 4. 立即 pull 一次
   */
  enable(): Promise<void>;

  /**
   * 禁用同步：
   * 1. 停止所有 ResourceSynchroniser
   * 2. 不清除本地数据（用户重新启用时直接复用）
   * 3. 不清除 outbox（待用户重新登录后继续）
   */
  disable(): Promise<void>;

  /** 立即同步（debounce 之外的手动触发） */
  syncNow(): Promise<void>;

  /**
   * 强制全量重同步（清空 cursor，从头 pull）。
   * 适用场景：用户跨设备登录后想拉全部历史 / 怀疑本地数据损坏。
   */
  forceFullResync(): Promise<void>;
}

export const ISyncService = createIdentifier<ISyncService>('sync.sync-service');
