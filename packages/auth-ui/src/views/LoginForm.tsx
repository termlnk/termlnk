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
  readonly onSubmit: (input: ILoginInput) => Promise<void> | void;
  readonly onSwitchToRegister?: () => void;
  readonly errorMessage?: string;
  readonly busy?: boolean;
}

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
        <div className={cn('tm:flex tm:items-center tm:justify-center tm:gap-1 tm:text-sm tm:text-grey-fg')}>
          <span>{localeService.t('auth-ui.login.no-account')}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={props.onSwitchToRegister}
            disabled={props.busy}
            className={cn('tm:h-auto tm:px-0 tm:font-medium')}
          >
            {localeService.t('auth-ui.login.go-register')}
          </Button>
        </div>
      )}
    </form>
  );
}
