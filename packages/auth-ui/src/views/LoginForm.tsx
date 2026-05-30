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
import { TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';

export interface ILoginFormProps {
  readonly onSubmit: (input: ILoginInput) => Promise<void> | void;
  // When provided, a "Continue with Google" button is rendered below the form.
  readonly onGoogleSignIn?: () => Promise<void> | void;
  readonly errorMessage?: string;
  readonly busy?: boolean;
}

// Google's multi-color "G" mark. Inlined as SVG since lucide ships no brand glyphs.
function GoogleGIcon() {
  return (
    <svg viewBox="0 0 48 48" className={cn('tm:size-4 tm:shrink-0')} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
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
      className={cn('tm:flex tm:flex-col tm:gap-5')}
    >
      <FieldGroup className={cn('tm:gap-4')}>
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
      </FieldGroup>

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
          ? localeService.t('auth-ui.login.submitting')
          : localeService.t('auth-ui.login.submit')}
      </Button>

      {props.onGoogleSignIn && (
        <>
          <div className={cn('tm:flex tm:items-center tm:gap-3')}>
            <div className={cn('tm:h-px tm:flex-1 tm:bg-line')} />
            <span className={cn('tm:text-xs tm:text-grey')}>
              {localeService.t('auth-ui.login.or-divider')}
            </span>
            <div className={cn('tm:h-px tm:flex-1 tm:bg-line')} />
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={props.busy}
            onClick={() => props.onGoogleSignIn?.()}
            className={cn('tm:flex tm:h-10 tm:w-full tm:items-center tm:justify-center tm:gap-2 tm:font-medium')}
          >
            <GoogleGIcon />
            {localeService.t('auth-ui.login.google')}
          </Button>
        </>
      )}
    </form>
  );
}
