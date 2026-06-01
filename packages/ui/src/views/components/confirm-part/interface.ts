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

import type { IConfirmVariant } from '@termlnk/design';
import type { ICustomWrapperProps } from '../custom-wrapper';

/**
 * Wire-format for a confirm dialog parameter. Wraps the design package's
 * `IConfirmProps` so that `title` and `description` can carry locale keys —
 * `ConfirmPart` resolves them via CustomWrapper, the same way `DialogPart`
 * does for dialogs. Keeps the design component locale-free.
 *
 * For interpolated strings (e.g. `'Foo {0}'`), call `localeService.t(key, …)`
 * at the caller and pass the resolved string as `{ title: '<resolved>' }` —
 * the unresolved string falls through CustomWrapper unchanged (see how
 * `LocaleService.t` returns the key when no match is found).
 */
export interface IConfirmPartOptions {
  id: string;

  title?: ICustomWrapperProps;
  description?: ICustomWrapperProps;

  cancelText?: string;
  confirmText?: string;

  confirmVariant?: IConfirmVariant;

  /**
   * Controlled visibility. The service flips this when `confirm()` / `open()`
   * resolves — call sites should leave it unset.
   */
  visible?: boolean;

  /** Invoked when the user clicks confirm. Disposed automatically by `confirm()`. */
  onConfirm?: () => void;

  /** Invoked when the user dismisses (cancel button or esc). */
  onCancel?: () => void;
}
