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
import type { SyncResourceId } from '../common/constants';
import type { ISyncMutation } from '../models/mutation';
import { createIdentifier } from '@termlnk/core';

/**
 * 待推送 mutation 队列。
 *
 * 持久化到 SQLite `sync_outbox` 表——离线时累积，重连后批量 flush。
 * 设计参考 Replicache pendingMutations + Linear LSE TransactionQueue。
 *
 * **去重语义**：服务端按 `(clientId, mutationId)` 幂等。客户端只需保证 mutationId 单调递增。
 */
export interface ISyncOutboxService {
  /** 待推送的 mutation 总数 */
  readonly pendingCount$: Observable<number>;

  /** 入队（在事务内调用——与触发本地 SQLite 写入一起完成原子提交） */
  enqueue(mutation: Omit<ISyncMutation, 'id' | 'createdAt'>): Promise<ISyncMutation>;

  /** 批量取出（FIFO）；不删除，直到 ack */
  peek(limit?: number): Promise<ISyncMutation[]>;

  /** 服务端确认接收后调用 — 按 mutationId 删除 */
  ack(mutationIds: number[]): Promise<void>;

  /** 服务端拒绝（如 baseVersion 冲突）— 标记重试 */
  markRejected(mutationIds: number[], reason: string): Promise<void>;

  /** 按资源 ID 统计 */
  countByResource(resource: SyncResourceId): Promise<number>;

  /** 清空特定资源（用于 forceFullResync） */
  clearResource(resource: SyncResourceId): Promise<void>;
}

export const ISyncOutboxService = createIdentifier<ISyncOutboxService>('sync.outbox-service');
