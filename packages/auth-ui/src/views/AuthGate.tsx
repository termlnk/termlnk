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

import type { IAuthError, ILoginInput, IRegisterInput, IUserAccount } from '@termlnk/auth';
import { AuthState, IAuthClientService } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { useState } from 'react';
import { AccountPanel } from './AccountPanel';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type ViewMode = 'login' | 'register';

/**
 * 主认证视图——按 IAuthClientService 状态切换 LoginForm / RegisterForm / AccountPanel。
 *
 * 优雅降级：
 * - 若 IAuthClientService 未注册（云端服务未启用、Phase 3 未上线），整个组件渲染
 *   "未配置云服务" 占位文案，按钮禁用。这是 Phase 1.5 的必然过渡态——
 *   要么用户主动 opt-in 云服务，要么管理员未部署后端。
 *
 * 错误处理：
 * - lastError$ 由 IAuthClientService 推送；本组件把当前 lastError 透传给子表单
 * - 用户切换 login/register 视图时清空错误（避免 stale 提示）——通过本地 viewMode state
 */
export function AuthGate() {
  const authClient = useDependency(IAuthClientService, Quantity.OPTIONAL);
  const logService = useDependency(ILogService);
  const localeService = useDependency(LocaleService);

  const currentUser = useObservable<IUserAccount | null>(
    authClient?.currentUser$ ?? null,
    null
  );
  const authState = useObservable<AuthState>(
    authClient?.authState$ ?? null,
    AuthState.Unauthenticated
  );
  const lastError = useObservable<IAuthError | null>(
    authClient?.lastError$ ?? null,
    null
  );

  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [hideErrorOnSwitch, setHideErrorOnSwitch] = useState(false);

  if (!authClient) {
    return (
      <div
        role="status"
        className={cn(`
          tm:flex tm:flex-col tm:gap-2 tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:p-4 tm:text-sm
          tm:text-grey-fg
        `)}
      >
        <div className={cn('tm:font-medium tm:text-light-grey')}>
          {localeService.t('auth-ui.gate.unavailable-title')}
        </div>
        <div>{localeService.t('auth-ui.gate.unavailable-detail')}</div>
      </div>
    );
  }

  const busy = authState === AuthState.Authenticating;
  const errorMessage = !hideErrorOnSwitch && lastError ? lastError.message : undefined;

  if (currentUser) {
    return (
      <AccountPanel
        user={currentUser}
        busy={busy}
        onLogout={async () => {
          try {
            await authClient.logout();
          } catch (err) {
            logService.error('[AuthGate] logout failed:', err);
          }
        }}
      />
    );
  }

  const switchTo = (next: ViewMode): void => {
    setHideErrorOnSwitch(true);
    setViewMode(next);
  };

  if (viewMode === 'register') {
    return (
      <RegisterForm
        busy={busy}
        errorMessage={errorMessage}
        onSwitchToLogin={() => switchTo('login')}
        onSubmit={async (input: IRegisterInput) => {
          setHideErrorOnSwitch(false);
          try {
            await authClient.register(input);
          } catch (err) {
            logService.error('[AuthGate] register failed:', err);
          }
        }}
      />
    );
  }

  return (
    <LoginForm
      busy={busy}
      errorMessage={errorMessage}
      onSwitchToRegister={() => switchTo('register')}
      onSubmit={async (input: ILoginInput) => {
        setHideErrorOnSwitch(false);
        try {
          await authClient.login(input);
        } catch (err) {
          logService.error('[AuthGate] login failed:', err);
        }
      }}
    />
  );
}
