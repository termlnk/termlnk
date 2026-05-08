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

export default {
  'auth-ui': {
    login: {
      email: 'Email',
      'email-placeholder': 'you@example.com',
      password: 'Password',
      'password-placeholder': 'Your master password',
      'remember-me': 'Stay signed in on this device',
      submit: 'Sign in',
      submitting: 'Signing in…',
      'no-account': "Don't have an account?",
      'go-register': 'Create one',
    },
    register: {
      email: 'Email',
      'email-placeholder': 'you@example.com',
      'display-name': 'Display name',
      'display-name-placeholder': 'How should we call you?',
      'display-name-hint': 'Optional. Falls back to the email prefix if blank.',
      password: 'Master password',
      'password-placeholder': 'At least {0} characters',
      'password-hint': 'This password derives the encryption key for all your synced data. We cannot recover it.',
      'password-too-short': 'Use at least {0} characters.',
      'password-mismatch': 'Passwords do not match.',
      confirm: 'Confirm password',
      submit: 'Create account',
      submitting: 'Creating…',
      'have-account': 'Already have an account?',
      'go-login': 'Sign in',
    },
    account: {
      'email-verified': 'Email verified',
      'email-unverified': 'Email not verified',
      logout: 'Sign out',
      'logging-out': 'Signing out…',
    },
    gate: {
      'unavailable-title': 'Cloud sync is not configured',
      'unavailable-detail': 'Sign-in becomes available once a cloud server is configured for this build.',
    },
  },
};
