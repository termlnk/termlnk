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
    welcome: {
      title: 'Welcome to Termlnk',
      subtitle: 'Sign in or create an account to sync your hosts and settings.',
    },
    switch: {
      'to-register-prompt': 'Don\'t have an account?',
      'to-register-action': 'Sign up',
      'to-login-prompt': 'Already have an account?',
      'to-login-action': 'Sign in',
    },
    login: {
      email: 'Email',
      'email-placeholder': 'you@example.com',
      password: 'Password',
      'password-placeholder': 'Enter your password',
      'trust-banner': 'Your password is derived locally and never sent to the server.',
      'remember-me': 'Stay signed in on this device',
      submit: 'Sign in',
      submitting: 'Signing in…',
      google: 'Continue with Google',
      'or-divider': 'or',
    },
    vault: {
      'setup-title': 'Set your encryption password',
      'setup-subtitle': 'This password encrypts your synced data end-to-end. It is separate from your Google account and cannot be recovered if lost.',
      'unlock-title': 'Unlock your data',
      'unlock-subtitle': 'Enter your encryption password to decrypt your synced data on this device.',
      password: 'Encryption password',
      'password-placeholder': 'At least {0} characters',
      confirm: 'Confirm password',
      'confirm-placeholder': 'Re-enter the password',
      'too-short': 'Use at least {0} characters.',
      mismatch: 'Passwords do not match.',
      warning: 'If you forget this password, your synced data cannot be recovered.',
      'setup-submit': 'Set password & continue',
      'unlock-submit': 'Unlock',
      submitting: 'Working…',
      'sign-out': 'Sign out instead',
    },
    register: {
      email: 'Email',
      'email-placeholder': 'you@example.com',
      'display-name': 'Display name',
      'display-name-placeholder': 'How should we call you?',
      'display-name-hint': 'Optional. Falls back to the email prefix if blank.',
      password: 'Password',
      'password-placeholder': 'At least {0} characters',
      'password-hint': 'This password derives the encryption key for all your synced data. We cannot recover it.',
      'password-too-short': 'Use at least {0} characters.',
      'password-mismatch': 'Passwords do not match.',
      confirm: 'Confirm password',
      submit: 'Create account',
      submitting: 'Creating…',
    },
    account: {
      'email-verified': 'Email verified',
      'email-unverified': 'Email not verified',
      'joined-at': 'Joined {0}',
      logout: 'Sign out',
      'logging-out': 'Signing out…',
    },
    'account-dialog': {
      title: 'Account',
      'tooltip-login': 'Sign in / Sign up',
      'tooltip-account': 'Account',
      'sync-title': 'Cloud Sync',
      'sync-description': 'Sync engine status and per-resource progress.',
    },
    gate: {
      'unavailable-title': 'Cloud sync is not configured',
      'unavailable-detail': 'Sign-in becomes available once a cloud server is configured for this build.',
    },
    devices: {
      title: 'Active devices',
      description: 'Devices signed in to this account. Revoke any you no longer recognize.',
      refresh: 'Refresh',
      empty: 'No active devices.',
      'this-device': 'This device',
      'unnamed-device': 'Unnamed device',
      'last-seen': 'Last active {0}',
      created: 'added {0}',
      revoke: 'Revoke',
      revoking: 'Revoking…',
      cancel: 'Cancel',
      'revoke-confirm-title': 'Revoke this device?',
      'revoke-confirm-current': '"{0}" is the device you are using right now. Revoking will sign you out shortly.',
      'revoke-confirm-other': '"{0}" will be signed out and forced to log in again on its next refresh.',
      'gated-hint': 'Sign in to manage your devices.',
      time: {
        'just-now': 'just now',
        'minutes-ago': '{0} minute(s) ago',
        'hours-ago': '{0} hour(s) ago',
        'days-ago': '{0} day(s) ago',
      },
    },
  },
};
