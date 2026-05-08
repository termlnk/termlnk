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

import type { ILoginInput } from '@termlnk/auth';
import { LocaleService } from '@termlnk/core';
import { Button, Checkbox, cn, Field, FieldContent, FieldGroup, FieldLabel, Input, Label, useDependency } from '@termlnk/design';
import { useState } from 'react';

export interface ILoginFormProps {
  /** 提交时调用；外层负责真正的认证逻辑（IAuthClientService.login）。 */
  readonly onSubmit: (input: ILoginInput) => Promise<void> | void;
  /** 切换到注册视图。 */
  readonly onSwitchToRegister?: () => void;
  /** 来自 IAuthClientService.lastError$，由外层订阅后传入。 */
  readonly errorMessage?: string;
  /** 外层在认证 in-flight 时设为 true，禁用提交按钮。 */
  readonly busy?: boolean;
}

/**
 * 登录表单——纯展示组件。
 *
 * 安全语义：
 * - password 只在 onSubmit 调用栈内瞬时使用；不通过 ref 存储、不放在 state 之外
 * - rememberMe 决定主进程是否持久化 refresh token（IAuthClientService 决定具体行为）
 * - 错误展示由外层提供 `errorMessage` 控制——本组件不做错误格式化（避免重复国际化）
 *
 * 不做的事：
 * - 不直接调 IAuthClientService（容器组件职责）
 * - 不做密码强度校验（注册路径才需要；登录用户输入啥就发啥）
 * - 不做 email 格式校验（服务端权威；前端校验只做 UX 提示，不做安全屏障）
 */
export function LoginForm(props: ILoginFormProps) {
  const localeService = useDependency(LocaleService);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !props.busy;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await props.onSubmit({
      email: email.trim(),
      password,
      rememberMe,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('tm:flex tm:flex-col tm:gap-4 tm:p-1')}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="auth-ui-login-email">
            {localeService.t('auth-ui.login.email')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-login-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={localeService.t('auth-ui.login.email-placeholder')}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="auth-ui-login-password">
            {localeService.t('auth-ui.login.password')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={localeService.t('auth-ui.login.password-placeholder')}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>

        <div className={cn('tm:flex tm:items-center tm:gap-2')}>
          <Checkbox
            id="auth-ui-login-remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked === true)}
            disabled={props.busy}
          />
          <Label htmlFor="auth-ui-login-remember" className={cn('tm:text-sm tm:text-grey-fg')}>
            {localeService.t('auth-ui.login.remember-me')}
          </Label>
        </div>
      </FieldGroup>

      {props.errorMessage && (
        <div
          role="alert"
          className={cn('tm:rounded-md tm:bg-red/10 tm:px-3 tm:py-2 tm:text-sm tm:text-red')}
        >
          {props.errorMessage}
        </div>
      )}

      <Button type="submit" disabled={!canSubmit} className={cn('tm:w-full')}>
        {props.busy
          ? localeService.t('auth-ui.login.submitting')
          : localeService.t('auth-ui.login.submit')}
      </Button>

      {props.onSwitchToRegister && (
        <div className={cn('tm:text-center tm:text-sm tm:text-grey-fg')}>
          {localeService.t('auth-ui.login.no-account')}
          {' '}
          <button
            type="button"
            onClick={props.onSwitchToRegister}
            className={cn(`
              tm:font-medium tm:text-blue tm:underline-offset-4
              tm:hover:underline
            `)}
            disabled={props.busy}
          >
            {localeService.t('auth-ui.login.go-register')}
          </button>
        </div>
      )}
    </form>
  );
}
