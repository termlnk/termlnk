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

/**
 * 备份字节流不跨 IPC——文件对话框和磁盘 I/O 都在主进程完成。
 * 渲染端的"导出"按钮应该调用 IBackupClientService.exportToFile()；
 * `Uint8Array` 永远不上行/下行。
 */
export interface IBackupExportFileResult {
  /** 用户最终选择的存盘绝对路径。 */
  readonly filePath: string;
  readonly exportedAt: number;
  readonly counts: Readonly<Record<string, number>>;
}

export interface IBackupImportFileResult {
  /** 用户选中的备份源文件绝对路径。 */
  readonly filePath: string;
  readonly mode: BackupImportMode;
  readonly exportedAt: number;
  readonly counts: Readonly<Record<string, number>>;
}

/**
 * 渲染端备份门面——承载用户从设置页触发的导出/导入交互。
 *
 * 与 IBackupService 的差别：
 * - 主进程版本以原始字节为契约；渲染端版本封装文件对话框 + 磁盘 I/O
 * - 用户取消对话框返回 `null`，已选路径错误（写入失败 / 解析失败）以异常上抛
 *
 * 主进程实现位置：rpc-server `backup` tRPC router；
 * 渲染端实现位置：rpc-client BackupClientService。
 */
export interface IBackupClientService {
  /** 弹保存对话框，加密导出到所选文件。用户取消返回 null。 */
  exportToFile(): Promise<IBackupExportFileResult | null>;
  /** 弹打开对话框，从所选文件解密导入。用户取消返回 null。 */
  importFromFile(mode: BackupImportMode): Promise<IBackupImportFileResult | null>;
}

export const IBackupClientService = createIdentifier<IBackupClientService>('sync.backup-client-service');
