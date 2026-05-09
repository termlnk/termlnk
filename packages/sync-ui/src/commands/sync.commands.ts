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

import type { IAccessor, ICommand } from '@termlnk/core';
import { Quantity } from '@termlnk/core';
import { ISyncService } from '@termlnk/sync';
import { firstValueFrom } from 'rxjs';

/**
 * 同步命令集——架构 §7.3 列出的 ID 契约，扩展 / 快捷键 / 脚本可通过
 * ICommandService.executeCommand 触发。
 *
 * 所有命令在 ISyncService 未绑定（云未配置）时静默返回 false——调用方据此
 * 判断"该命令在当前 build 不可用"，不会因 RPC 异常而崩。
 */

/** sync.command.sync-now —— 立即 push + pull（与 SyncStatusPanel 的 Sync now 按钮等价）。 */
export const SyncNowCommand: ICommand = {
  id: 'sync.command.sync-now',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.syncNow();
    return true;
  },
};

/** sync.command.enable —— 启用同步引擎（首次启用 + 注册 ResourceSynchroniser）。 */
export const EnableSyncCommand: ICommand = {
  id: 'sync.command.enable',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.enable();
    return true;
  },
};

/** sync.command.disable —— 关闭同步引擎；不清本地数据。 */
export const DisableSyncCommand: ICommand = {
  id: 'sync.command.disable',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.disable();
    return true;
  },
};

/**
 * sync.command.toggle-enabled —— 单键开关：根据当前 enabled$ 翻转。
 * 用于绑快捷键场景，比手动 enable / disable 更顺手。
 */
export const ToggleSyncEnabledCommand: ICommand = {
  id: 'sync.command.toggle-enabled',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    const enabled = await firstValueFrom(sync.enabled$);
    if (enabled) {
      await sync.disable();
    } else {
      await sync.enable();
    }
    return true;
  },
};

/** sync.command.force-full-resync —— 清空所有 cursor 后从头 pull（与"从头同步"按钮等价）。 */
export const ForceFullResyncCommand: ICommand = {
  id: 'sync.command.force-full-resync',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const sync = accessor.get(ISyncService, Quantity.OPTIONAL);
    if (!sync) {
      return false;
    }
    await sync.forceFullResync();
    return true;
  },
};

export const SYNC_COMMANDS: readonly ICommand[] = [
  SyncNowCommand,
  EnableSyncCommand,
  DisableSyncCommand,
  ToggleSyncEnabledCommand,
  ForceFullResyncCommand,
] as const;
