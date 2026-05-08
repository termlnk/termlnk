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

import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { SyncResourceId } from '../common/constants';
import type { ISyncMutation, ISyncPatchItem } from '../models/mutation';
import type { SynchroniserStatus } from '../models/state';

/**
 * Resource Synchroniser — 一个资源类型一个实例。
 *
 * 设计参考：VSCode IUserDataSynchroniser（每类资源独立 synchroniser）+ Replicache mutator。
 *
 * 实现职责：
 * 1. 订阅对应 Repository 的 changed$，把变更入队 outbox（push 路径）
 * 2. 收到 patch 项时，解密 + 应用到 Repository（pull 路径）
 * 3. 维护 per-resource cursor + sync metadata
 * 4. 字段级 LWW（仅 config 资源需要）由各自 Synchroniser 内部决定，不污染契约层
 */
export interface IResourceSynchroniser extends IDisposable {
  readonly resourceId: SyncResourceId;
  readonly status$: Observable<SynchroniserStatus>;

  /**
   * 启动监听 — 订阅 Repository.changed$，转换为 mutations 入 outbox。
   * 调用后会持续监听直到 dispose。
   */
  start(): void;

  /**
   * 把一组 patch 应用到本地 Repository。
   * 由 SyncService 在 pull 完成后调用——payload 解密 + 行级 / 字段级 LWW 由实现决定。
   */
  applyPatch(patch: ISyncPatchItem[]): Promise<void>;

  /**
   * 把本地变更序列化 + 加密为 mutation，供 SyncService push 时使用。
   * 由 ResourceSynchroniser 内部决定何时调用——通常通过 changed$ 订阅触发。
   */
  buildMutations(): Promise<ISyncMutation[]>;

  /**
   * 强制重新派生所有本地行的初始 mutations（用于首次启用同步或 forceFullResync）。
   */
  buildInitialSnapshot(): Promise<ISyncMutation[]>;
}

/** Synchroniser 工厂（DI 注入用） */
export interface IResourceSynchroniserFactory {
  create(): IResourceSynchroniser;
  readonly resourceId: SyncResourceId;
}
