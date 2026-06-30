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

import { LocaleService } from '@termlnk/core';
import { Button, cn, Field, FieldContent, FieldGroup, FieldLabel, Input, useDependency } from '@termlnk/design';
import { InfoIcon, KeyRoundIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';

const MIN_PASSWORD_LENGTH = 8;

export interface IChangePasswordFormProps {
  readonly onSubmit: (oldPassword: string, newPassword: string) => Promise<void> | void;
  readonly errorMessage?: string;
  readonly busy?: boolean;
}

export function ChangePasswordForm(props: IChangePasswordFormProps) {
  const localeService = useDependency(LocaleService);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const canSubmit
    = currentPassword.length > 0
      && newPassword.length >= MIN_PASSWORD_LENGTH
      && newPassword === confirm
      && !props.busy;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await props.onSubmit(currentPassword, newPassword);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('tm:flex tm:flex-col tm:gap-5')}
    >
      <div className={cn('tm:flex tm:flex-col tm:gap-1')}>
        <div className={cn('tm:flex tm:items-center tm:gap-2 tm:font-medium tm:text-light-grey')}>
          <KeyRoundIcon className={cn('tm:size-4 tm:shrink-0 tm:text-blue')} />
          {localeService.t('auth-ui.change-password.title')}
        </div>
        <p className={cn('tm:text-sm tm:text-grey-fg')}>
          {localeService.t('auth-ui.change-password.subtitle')}
        </p>
      </div>

      <FieldGroup className={cn('tm:gap-4')}>
        <Field>
          <FieldLabel htmlFor="auth-ui-current-password">
            {localeService.t('auth-ui.change-password.current')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-current-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={localeService.t('auth-ui.change-password.current-placeholder')}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="auth-ui-new-password">
            {localeService.t('auth-ui.change-password.new')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-new-password"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={localeService.t('auth-ui.change-password.new-placeholder', String(MIN_PASSWORD_LENGTH))}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="auth-ui-confirm-password">
            {localeService.t('auth-ui.change-password.confirm')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={localeService.t('auth-ui.change-password.confirm-placeholder')}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>
      </FieldGroup>

      {tooShort && (
        <p className={cn('tm:text-sm tm:text-yellow')}>
          {localeService.t('auth-ui.change-password.too-short', String(MIN_PASSWORD_LENGTH))}
        </p>
      )}
      {mismatch && (
        <p className={cn('tm:text-sm tm:text-yellow')}>
          {localeService.t('auth-ui.change-password.mismatch')}
        </p>
      )}

      <div
        className={cn(`
          tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:border tm:border-blue/20 tm:bg-blue/8 tm:px-3 tm:py-2
          tm:text-xs tm:text-grey-fg
        `)}
      >
        <InfoIcon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0 tm:text-blue')} />
        <span>{localeService.t('auth-ui.change-password.warning')}</span>
      </div>

      {props.errorMessage && (
        <div
          role="alert"
          className={cn(`
            tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-red/10 tm:px-3 tm:py-2 tm:text-sm tm:text-red
          `)}
        >
          <TriangleAlertIcon className={cn('tm:mt-0.5 tm:size-4 tm:shrink-0')} />
          <span>{props.errorMessage}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={!canSubmit}
        className={cn('tm:h-10 tm:w-full tm:font-semibold')}
      >
        {props.busy
          ? localeService.t('auth-ui.change-password.submitting')
          : localeService.t('auth-ui.change-password.submit')}
      </Button>
    </form>
  );
}
