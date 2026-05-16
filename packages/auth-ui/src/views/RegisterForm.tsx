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

// UX nudge, not a security gate; Argon2id is the actual brute-force defense.
const MIN_PASSWORD_LENGTH = 8;

export interface IRegisterFormProps {
  readonly onSubmit: (input: IRegisterInput) => Promise<void> | void;
  readonly onSwitchToLogin?: () => void;
  readonly errorMessage?: string;
  readonly busy?: boolean;
}

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
        <div className={cn('tm:flex tm:items-center tm:justify-center tm:gap-1 tm:text-sm tm:text-grey-fg')}>
          <span>{localeService.t('auth-ui.register.have-account')}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={props.onSwitchToLogin}
            disabled={props.busy}
            className={cn('tm:h-auto tm:px-0 tm:font-medium')}
          >
            {localeService.t('auth-ui.register.go-login')}
          </Button>
        </div>
      )}
    </form>
  );
}
