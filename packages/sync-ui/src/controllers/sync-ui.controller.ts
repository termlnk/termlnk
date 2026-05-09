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

import { Disposable, ICommandService } from '@termlnk/core';
import { SYNC_COMMANDS } from '../commands/sync.commands';

/**
 * SyncUI 控制器——把架构 §7.3 列出的 sync.command.* 注册到 ICommandService。
 *
 * 所有命令的具体逻辑都在 sync.commands.ts，控制器只承担"在合适生命周期注册 + dispose 撤销"
 * 的职责。命令本身用 Quantity.OPTIONAL 取 ISyncService，所以即便云未配置也不会崩。
 */
export class SyncUIController extends Disposable {
  constructor(
    @ICommandService private readonly _commandService: ICommandService
  ) {
    super();

    for (const command of SYNC_COMMANDS) {
      this.disposeWithMe(this._commandService.registerCommand(command));
    }
  }
}
