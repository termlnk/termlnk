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

/**
 * Bind ⌘Y / ⌘N to the currently active permission request.
 *
 * Callers pass pre-bound intents (from `IPermissionRequestService`) so
 * this hook stays free of business logic — it only maps keystrokes to
 * the provided callbacks.
 */
export function usePermissionKeyboard(
  requestId: string,
  onAllow: () => void,
  onDeny: () => void
): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey) {
        return;
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
  }, [requestId, onAllow, onDeny]);
}
