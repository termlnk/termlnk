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

import { createIdentifier } from '@termlnk/core';

/** 加密备份文件的字节流前缀（区别于 sync push payload 的 `tmsync1:`）。 */
export const BACKUP_PAYLOAD_PREFIX = 'tmbak1:';

/** 备份格式版本号——升级序列化结构时增加。 */
export const BACKUP_PAYLOAD_VERSION = 1;

/** 导入语义。 */
export type BackupImportMode = 'replace' | 'merge';

export interface IBackupExportSummary {
  /** 备份生成时间戳（epoch ms） */
  readonly exportedAt: number;
  /** 各资源行数（仅做 UI 展示，无业务依赖） */
  readonly counts: Readonly<Record<string, number>>;
}

export interface IBackupImportSummary {
  readonly mode: BackupImportMode;
  /** 备份生成时间戳（来自文件，非导入时间） */
  readonly exportedAt: number;
  readonly counts: Readonly<Record<string, number>>;
}

/**
 * 加密备份导出/导入（**仅主进程**）。
 *
 * 用例：
 * - 用户在设备 A 上导出 → 移到设备 B 输入主密码 → 还原全量配置（host / config / ai / mcp / skill）
 * - chat / 终端会话备份 / mcp_oauth_token 不在备份范围（cloud-sync-architecture.md §4.4）
 *
 * 文件格式：
 * ```
 *   [BACKUP_PAYLOAD_PREFIX (8 bytes)] [tmsync1: 加密 frame]
 * ```
 * 内层 `tmsync1:` 是 sync E2EE master key 加密；外层 `tmbak1:` 让 forensics
 * 从字节流首位即可辨识"这是 termlnk 备份文件"，与运行时同步 payload 区分。
 *
 * 调用前置条件：master key 已 unlocked。否则 export/import 都抛错。
 */
export interface IBackupService {
  /** 全量导出当前 DB 内可同步资源；返回加密字节（直接写文件）。 */
  exportEncryptedBackup(): Promise<{ payload: Uint8Array; summary: IBackupExportSummary }>;

  /**
   * 解密备份字节流并写回 DB。
   * 默认 `replace`——清空所有相关表后批量插入（最常见的"换机"语义）。
   * `merge` 在 P2.5 LWW 同步引擎落地后再开（需要字段级元数据校准）。
   */
  importEncryptedBackup(payload: Uint8Array, mode: BackupImportMode): Promise<IBackupImportSummary>;
}

export const IBackupService = createIdentifier<IBackupService>('sync.backup-service');
