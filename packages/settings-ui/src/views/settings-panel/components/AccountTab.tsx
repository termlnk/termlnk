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

import { IAuthClientService } from '@termlnk/auth';
import { AuthGate } from '@termlnk/auth-ui';
import { LocaleService, Quantity } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn, useDependency } from '@termlnk/design';
import { ISyncService } from '@termlnk/sync';
import { SyncStatusPanel } from '@termlnk/sync-ui';

/**
 * 账号 + 同步标签页——把 auth-ui 的 AuthGate 和 sync-ui 的 SyncStatusPanel
 * 合并到 settings-ui 的标签体系下。
 *
 * 三层降级：
 * 1. IAuthClientService 未注册 → 显示 "云服务未配置" 占位（auth-ui 默认行为）
 * 2. IAuthClientService 已注册但用户未登录 → AuthGate 渲染 LoginForm/RegisterForm
 * 3. 已登录 → AuthGate 渲染 AccountPanel；下方 SyncStatusPanel 渲染同步状态
 *
 * Phase 3 落地后，IAuthClientService 由 RPCClientPlugin 或 AuthCorePlugin 注册，
 * 同步将在登录时自动激活——本 tab 不需要任何改动。
 */
export function AccountTab() {
  const localeService = useDependency(LocaleService);
  const authClient = useDependency(IAuthClientService, Quantity.OPTIONAL);
  const syncService = useDependency(ISyncService, Quantity.OPTIONAL);

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-4')}>
      <Card>
        <CardHeader>
          <CardTitle className={cn('tm:text-sm')}>
            {localeService.t('settings-ui.account.section-account')}
          </CardTitle>
          <CardDescription className={cn('tm:text-xs')}>
            {localeService.t('settings-ui.account.section-account-description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthGate />
        </CardContent>
      </Card>

      {syncService && authClient && (
        <Card>
          <CardHeader>
            <CardTitle className={cn('tm:text-sm')}>
              {localeService.t('settings-ui.account.section-sync')}
            </CardTitle>
            <CardDescription className={cn('tm:text-xs')}>
              {localeService.t('settings-ui.account.section-sync-description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncStatusPanel />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
