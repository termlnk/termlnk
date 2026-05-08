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

import type { SyncResourceId } from '../common/constants';

/** 全局同步状态（面向用户 UI 展示） */
export enum SyncState {
  /** 未启用同步（用户未登录或未启用） */
  Disabled = 'disabled',
  /** 已启用但当前未活动（idle） */
  Idle = 'idle',
  /** 正在 push / pull */
  Syncing = 'syncing',
  /** 离线（网络不通或后端不可达） */
  Offline = 'offline',
  /** 错误（详情见 lastError） */
  Error = 'error',
}

/** 单个 Synchroniser 状态（per-resource 粒度） */
export enum SynchroniserStatus {
  Idle = 'idle',
  PushingMutations = 'pushing',
  PullingPatch = 'pulling',
  ApplyingPatch = 'applying',
  Error = 'error',
}

export interface ISyncStats {
  readonly pendingMutations: number;
  readonly lastSyncedAt: number | null;
  readonly perResource: Record<SyncResourceId, IResourceSyncStats>;
}

export interface IResourceSyncStats {
  readonly status: SynchroniserStatus;
  readonly pendingCount: number;
  readonly lastSyncedAt: number | null;
  readonly cursor: string | null;
}

export type SyncErrorCode =
  | 'unauthenticated' // 未登录或 token 失效
  | 'master_key_locked' // 同步需要 master key 但当前 locked
  | 'network' // 网络不可达
  | 'rate_limited' // 服务端限流
  | 'protocol_mismatch' // 客户端/服务端 schema 版本不匹配
  | 'cipher_mismatch' // 解密失败（密钥错误或数据损坏）
  | 'server_error' // 服务端 5xx
  | 'unknown';

export interface ISyncError {
  code: SyncErrorCode;
  message: string;
  /** 触发错误的资源（若有） */
  resource?: SyncResourceId;
  /** 是否需要用户介入（如重新登录、重新派生密钥） */
  requiresUserAction?: boolean;
}
