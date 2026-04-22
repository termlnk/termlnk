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

import { useEffect } from 'react';

interface IOptionKeyboardConfig {
  readonly optionCount: number;
  readonly onSelectOption: (index: number) => void;
}

/**
 * Bind ⌘Y / ⌘N / ⌘1–⌘9 to the currently active pending interaction.
 *
 * Callers pass pre-bound intents (from `IPermissionRequestService`) so
 * this hook stays free of business logic — it only maps keystrokes to
 * the provided callbacks.
 *
 * When `disabled` is true (set by the caller when a `QuestionPanel` is
 * rendering and owns its own keyboard scheme), the hook unbinds its
 * listener so the two keyboard owners never race for the same keystroke.
 */
export function usePermissionKeyboard(
  requestId: string,
  onAllow: () => void,
  onDeny: () => void,
  options?: IOptionKeyboardConfig,
  disabled?: boolean
): void {
  useEffect(() => {
    if (disabled) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey) {
        return;
      }

      if (options) {
        const num = Number.parseInt(e.key, 10);
        if (num >= 1 && num <= options.optionCount) {
          e.preventDefault();
          options.onSelectOption(num - 1);
          return;
        }
      }

      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        onAllow();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        onDeny();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [requestId, onAllow, onDeny, options, disabled]);
}
