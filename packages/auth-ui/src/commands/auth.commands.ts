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
import { IAuthClientService } from '@termlnk/auth';
import { Quantity } from '@termlnk/core';

/**
 * Auth 命令集——架构 §7.3 列出的 ID 契约。
 *
 * 注：架构同时列了 `auth.command.login`，但登录需要凭据输入，零知识架构下没有
 * "无参数程序登录"的语义；因此这里只注册 logout（无参数即可执行）。后续若有
 * "用 stored credentials 自动登录"等场景再扩。
 */

/** auth.command.logout —— 程序化登出。IAuthClientService 未绑定（云未配置）时返回 false。 */
export const LogoutCommand: ICommand = {
  id: 'auth.command.logout',
  handler: async (accessor: IAccessor): Promise<boolean> => {
    const auth = accessor.get(IAuthClientService, Quantity.OPTIONAL);
    if (!auth) {
      return false;
    }
    await auth.logout();
    return true;
  },
};

export const AUTH_COMMANDS: readonly ICommand[] = [
  LogoutCommand,
] as const;
