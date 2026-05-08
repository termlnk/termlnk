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

import type { IRegisterInput } from '@termlnk/auth';
import { LocaleService } from '@termlnk/core';
import { Button, cn, Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, Input, useDependency } from '@termlnk/design';
import { useMemo, useState } from 'react';

/**
 * 主密码最小长度——不是安全护栏（暴力攻击主要由 Argon2id 抵御），而是
 * 提醒用户用户使用人类可记的、但不至于太短的密码。
 */
const MIN_PASSWORD_LENGTH = 8;

export interface IRegisterFormProps {
  readonly onSubmit: (input: IRegisterInput) => Promise<void> | void;
  readonly onSwitchToLogin?: () => void;
  readonly errorMessage?: string;
  readonly busy?: boolean;
}

/**
 * 注册表单——纯展示组件。
 *
 * 设计要点：
 * - **密码二次确认**：register 一旦提交，密码就经 SRP6a + Argon2id 派生 verifier；
 *   一旦上传 verifier 后用户忘记密码 = 数据永久丢失（零知识架构无法找回）。
 *   二次确认是唯一的纠错关口。
 * - 显示密码长度建议但不强制——超短密码也允许（例如 `passphrase` 形式），
 *   服务端不能拒绝（拒绝意味着服务端能区分密码强度→破坏零知识）。
 * - displayName 可选（服务端把空字符串视为未设置，UI 用 email 兜底显示）。
 */
export function RegisterForm(props: IRegisterFormProps) {
  const localeService = useDependency(LocaleService);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');

  const passwordsMatch = password.length > 0 && password === confirm;
  const validation = useMemo<{ kind: 'ok' | 'mismatch' | 'short'; message?: string }>(() => {
    if (password.length === 0) {
      return { kind: 'ok' };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        kind: 'short',
        message: localeService.t('auth-ui.register.password-too-short', String(MIN_PASSWORD_LENGTH)),
      };
    }
    if (confirm.length > 0 && password !== confirm) {
      return {
        kind: 'mismatch',
        message: localeService.t('auth-ui.register.password-mismatch'),
      };
    }
    return { kind: 'ok' };
  }, [password, confirm, localeService]);

  const canSubmit = email.trim().length > 0
    && password.length >= MIN_PASSWORD_LENGTH
    && passwordsMatch
    && !props.busy;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await props.onSubmit({
      email: email.trim(),
      password,
      displayName: displayName.trim().length > 0 ? displayName.trim() : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('tm:flex tm:flex-col tm:gap-4 tm:p-1')}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="auth-ui-register-email">
            {localeService.t('auth-ui.register.email')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-register-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={localeService.t('auth-ui.register.email-placeholder')}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="auth-ui-register-display-name">
            {localeService.t('auth-ui.register.display-name')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-register-display-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={localeService.t('auth-ui.register.display-name-placeholder')}
              disabled={props.busy}
            />
          </FieldContent>
          <FieldDescription>
            {localeService.t('auth-ui.register.display-name-hint')}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="auth-ui-register-password">
            {localeService.t('auth-ui.register.password')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-register-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={localeService.t('auth-ui.register.password-placeholder', String(MIN_PASSWORD_LENGTH))}
              disabled={props.busy}
            />
          </FieldContent>
          <FieldDescription>
            {localeService.t('auth-ui.register.password-hint')}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="auth-ui-register-confirm">
            {localeService.t('auth-ui.register.confirm')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-register-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      {validation.kind !== 'ok' && (
        <div
          role="alert"
          className={cn('tm:rounded-md tm:bg-yellow/10 tm:px-3 tm:py-2 tm:text-sm tm:text-yellow')}
        >
          {validation.message}
        </div>
      )}

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
          ? localeService.t('auth-ui.register.submitting')
          : localeService.t('auth-ui.register.submit')}
      </Button>

      {props.onSwitchToLogin && (
        <div className={cn('tm:text-center tm:text-sm tm:text-grey-fg')}>
          {localeService.t('auth-ui.register.have-account')}
          {' '}
          <button
            type="button"
            onClick={props.onSwitchToLogin}
            className={cn(`
              tm:font-medium tm:text-blue tm:underline-offset-4
              tm:hover:underline
            `)}
            disabled={props.busy}
          >
            {localeService.t('auth-ui.register.go-login')}
          </button>
        </div>
      )}
    </form>
  );
}
