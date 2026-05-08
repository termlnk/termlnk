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
import type { ISyncMutation, ISyncPatchItem } from '../models/mutation';
import { createIdentifier } from '@termlnk/core';

export interface IPushRequest {
  readonly clientId: string;
  readonly mutations: readonly ISyncMutation[];
}

export interface IPushResponse {
  /** 成功接受的 mutation IDs */
  readonly accepted: readonly number[];
  /** 因冲突（baseVersion mismatch）等被拒绝；客户端需 pull 后重试 */
  readonly rejected: readonly { id: number; reason: string }[];
  /** 服务端最新的全局版本号（debug / monitoring 用） */
  readonly lastServerVersion: number;
}

export interface IPullRequest {
  readonly clientId: string;
  readonly resource: SyncResourceId;
  readonly cursor: string | null;
}

export interface IPullResponse {
  readonly cursor: string;
  readonly patch: readonly ISyncPatchItem[];
  /** 此 client 的最新已确认 mutationId（帮助清理 outbox） */
  readonly lastMutationId: number;
}

/** 服务端 poke 信号（无 payload，仅唤醒客户端 pull） */
export interface IPokeMessage {
  readonly type: 'poke';
  readonly resource: SyncResourceId;
  /** 服务端最新 cursor（客户端可用其判断是否真的需要 pull） */
  readonly cursor: string;
}

/**
 * 同步传输层抽象——实现细节（HTTP/WebSocket）由 @termlnk/sync-core 提供。
 *
 * 设计参考 Replicache push/pull/poke 三件套：
 * - push：客户端主动调；服务端原子写入 + 计算新 version
 * - pull：客户端主动调；服务端按 cursor 计算 patch + 新 cursor
 * - poke：服务端推；仅是"有更新"信号，不传 payload
 */
export interface ISyncTransportService {
  /** 长连接状态 */
  readonly connected$: Observable<boolean>;
  /** 服务端 poke 流 */
  readonly poke$: Observable<IPokeMessage>;

  push(req: IPushRequest): Promise<IPushResponse>;
  pull(req: IPullRequest): Promise<IPullResponse>;

  /** 建立 WebSocket 长连接（启用同步时调用） */
  connect(): Promise<void>;
  /** 断开（禁用同步 / 登出时调用） */
  disconnect(): Promise<void>;
}

export const ISyncTransportService = createIdentifier<ISyncTransportService>('sync.transport-service');
