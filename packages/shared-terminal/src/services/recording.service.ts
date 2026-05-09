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
import { createIdentifier } from '@termlnk/core';

/**
 * 录制句柄——start 返回；调用 stop 后落盘并写入 listings。
 */
export interface IRecordingHandle {
  readonly id: string;
  readonly sessionId: string;
  readonly startedAt: number;
  /** 文件绝对路径——`~/.termlnk/recordings/<id>.cast` */
  readonly path: string;
  /** 是否 auditor 触发的强制录制（UI 不允许停止） */
  readonly mandatory: boolean;
}

/**
 * 录制元信息——listRecordings 返回。
 */
export interface IRecordingMetadata {
  readonly id: string;
  readonly sessionId: string;
  readonly title: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly path: string;
  readonly bytes: number;
  /** 同名 audit log 文件路径——`~/.termlnk/recordings/<id>.audit.jsonl` */
  readonly auditLogPath: string | null;
}

/**
 * 录制 / 审计服务——asciicast v2 + audit JSON Lines。
 *
 * 设计依据：cloud-sync-architecture.md §5.7.6。
 *
 * **格式**：
 * - asciicast v2（JSON Lines）—— 与 asciinema 工具链兼容
 * - audit JSONL —— 每行一个事件（参与者加入/离开 / role_changed / kick / rekey 等）
 *
 * **存储**：仅 owner 本地（`~/.termlnk/recordings/`）；relay 永远 zero-knowledge 不持有录制。
 *
 * **触发**：
 * - 默认 off（性能 + 隐私默认）
 * - owner 在协作 session dialog 勾选 → on
 * - 任何 auditor 加入 → 强制 on，UI 显著提示
 *
 * 实现位置：@termlnk/shared-terminal-core (P5.4)
 */
export interface ISharedSessionRecordingService {
  /**
   * 启动录制——调用方传 sessionId + 标题；mandatory 由调用方判定（auditor 加入时 true）。
   * 返回的 handle 用于停止；duplicate start（同 sessionId 已在录制）则返回已有 handle。
   */
  start(options: { sessionId: string; title: string; mandatory: boolean }): Promise<IRecordingHandle>;

  /**
   * 停止录制并 flush 到磁盘。
   * - 非强制录制：直接停止
   * - 强制录制：仅当 auditor 全部离开时停止；否则抛错
   */
  stop(handle: IRecordingHandle, force?: boolean): Promise<void>;

  /**
   * 列出本地所有录制（按 startedAt 倒序）。
   * UI 用作"录制历史"面板。
   */
  list(): Promise<readonly IRecordingMetadata[]>;

  /**
   * 删除录制（cast 文件 + audit log 一起）。返回是否删除成功。
   */
  delete(id: string): Promise<boolean>;

  /** 当前活跃录制句柄列表 */
  readonly activeRecordings$: Observable<readonly IRecordingHandle[]>;
}

export const ISharedSessionRecordingService = createIdentifier<ISharedSessionRecordingService>(
  'shared-terminal.session-recording-service'
);
