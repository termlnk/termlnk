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

/**
 * 本地待推送的 mutation。
 *
 * 模型对齐 Replicache Row Version Strategy（cloud-sync-architecture.md §1.3 / §4.3）：
 * - 客户端 mutationId 单调递增，服务端用 (clientId, mutationId) 去重
 * - baseVersion 是写入时本地认为的当前行版本号——服务端用其做乐观并发检查
 * - payload 是 ENCRYPTED 字节（XChaCha20-Poly1305，sync E2EE key），服务端零知识存储
 */
export interface ISyncMutation {
  /** 本端单调递增 ID（per-device，用于 server 去重） */
  readonly id: number;
  readonly resource: SyncResourceId;
  readonly op: 'upsert' | 'delete';
  readonly entityId: string;
  /** 加密 payload；delete 时为 null */
  readonly payload: Uint8Array | null;
  /** 写入时本地观测的服务端 version；首次创建为 null */
  readonly baseVersion: number | null;
  readonly createdAt: number;
}

/**
 * 服务端拉取的 patch 项 — 与 Replicache pull endpoint 对齐。
 */
export interface ISyncPatchItem {
  readonly op: 'put' | 'del' | 'clear';
  readonly resource: SyncResourceId;
  /** 'clear' 时为 null */
  readonly entityId: string | null;
  /** 加密 payload；del/clear 时为 null */
  readonly payload: Uint8Array | null;
  /** 服务端分配的单调递增版本号 */
  readonly version: number;
}

/**
 * 字段级元数据（仅 config 表使用，因为 value 是嵌套 JSON）。
 * 行级资源（host / ai_provider 等）不需要本结构——元数据存于 sync_row_meta。
 */
export interface ISyncFieldMeta {
  readonly resource: SyncResourceId;
  readonly entityId: string;
  readonly field: string;
  readonly updatedAt: number;
}

/**
 * 本地观测的服务端游标。
 * push/pull 之间通过它标识"客户端已知的最新服务端状态"——
 * 服务端按 cursor 计算 patch 列表（参考 Replicache Client View Record）。
 */
export interface ISyncCursor {
  readonly resource: SyncResourceId;
  /** 服务端 opaque cursor（base64，客户端不解析内容） */
  readonly value: string;
  readonly lastPulledAt: number;
}
