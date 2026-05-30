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
import { LockIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';

// UX-only soft minimum; Argon2id is the real guardrail (mirrors RegisterForm).
const MIN_PASSWORD_LENGTH = 8;

export type VaultFormMode = 'setup' | 'unlock';

export interface IVaultFormProps {
  readonly mode: VaultFormMode;
  // 'setup' derives + uploads a new verifier; 'unlock' verifies against the stored one.
  readonly onSubmit: (password: string) => Promise<void> | void;
  // The signed-in account this vault belongs to — shown for context.
  readonly email?: string;
  readonly errorMessage?: string;
  readonly busy?: boolean;
}

/**
 * Encryption-password form for OAuth accounts, where identity (Google) and the
 * end-to-end encryption key are decoupled. `setup` is the first-time path (with a
 * confirmation field + irreversibility warning); `unlock` re-derives the key on a
 * device that already has a password set.
 */
export function VaultForm(props: IVaultFormProps) {
  const localeService = useDependency(LocaleService);
  const isSetup = props.mode === 'setup';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = isSetup && password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = isSetup && confirm.length > 0 && password !== confirm;
  const canSubmit
    = password.length > 0
      && !props.busy
      && (!isSetup || (password.length >= MIN_PASSWORD_LENGTH && password === confirm));

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await props.onSubmit(password);
  };

  const title = localeService.t(isSetup ? 'auth-ui.vault.setup-title' : 'auth-ui.vault.unlock-title');
  const subtitle = localeService.t(isSetup ? 'auth-ui.vault.setup-subtitle' : 'auth-ui.vault.unlock-subtitle');

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('tm:flex tm:flex-col tm:gap-5')}
    >
      <div className={cn('tm:flex tm:flex-col tm:gap-1')}>
        <div className={cn('tm:flex tm:items-center tm:gap-2 tm:font-medium tm:text-light-grey')}>
          <LockIcon className={cn('tm:size-4 tm:shrink-0 tm:text-blue')} />
          {title}
        </div>
        <p className={cn('tm:text-sm tm:text-grey-fg')}>{subtitle}</p>
        {props.email && (
          <p className={cn('tm:text-xs tm:text-grey')}>{props.email}</p>
        )}
      </div>

      <FieldGroup className={cn('tm:gap-4')}>
        <Field>
          <FieldLabel htmlFor="auth-ui-vault-password">
            {localeService.t('auth-ui.vault.password')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="auth-ui-vault-password"
              type="password"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={localeService.t('auth-ui.vault.password-placeholder', String(MIN_PASSWORD_LENGTH))}
              disabled={props.busy}
            />
          </FieldContent>
        </Field>

        {isSetup && (
          <Field>
            <FieldLabel htmlFor="auth-ui-vault-confirm">
              {localeService.t('auth-ui.vault.confirm')}
            </FieldLabel>
            <FieldContent>
              <Input
                id="auth-ui-vault-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={localeService.t('auth-ui.vault.confirm-placeholder')}
                disabled={props.busy}
              />
            </FieldContent>
          </Field>
        )}
      </FieldGroup>

      {tooShort && (
        <p className={cn('tm:text-sm tm:text-yellow')}>
          {localeService.t('auth-ui.vault.too-short', String(MIN_PASSWORD_LENGTH))}
        </p>
      )}
      {mismatch && (
        <p className={cn('tm:text-sm tm:text-yellow')}>
          {localeService.t('auth-ui.vault.mismatch')}
        </p>
      )}

      {isSetup && (
        <div
          className={cn(`
            tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:border tm:border-yellow/20 tm:bg-yellow/8 tm:px-3 tm:py-2
            tm:text-xs tm:text-grey-fg
          `)}
        >
          <TriangleAlertIcon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0 tm:text-yellow')} />
          <span>{localeService.t('auth-ui.vault.warning')}</span>
        </div>
      )}

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
          ? localeService.t('auth-ui.vault.submitting')
          : localeService.t(isSetup ? 'auth-ui.vault.setup-submit' : 'auth-ui.vault.unlock-submit')}
      </Button>
    </form>
  );
}
