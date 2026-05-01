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
import { useDependency, useObservable } from '@termlnk/design';
import { IPermissionClientService } from '@termlnk/rpc-client';
import { AlertCircle } from 'lucide-react';
import { memo, useCallback } from 'react';

const PILL_ANCHOR_ATTR = 'data-permission-anchor';

/**
 * Marks the closest ToolApprovalCard so the pill can scroll to the first
 * pending request when clicked. Looks up by IAgentToolPermissionRequest.id.
 */
export const PERMISSION_ANCHOR_ATTR = PILL_ANCHOR_ATTR;

export const PendingApprovalsPill = memo(function PendingApprovalsPill() {
  const localeService = useDependency(LocaleService);
  const permissionService = useDependency(IPermissionClientService);
  const pending = useObservable(permissionService.pendingRequests$, []);

  const t = (key: string, ...args: string[]): string =>
    localeService.t(`agent-ui.permission.${key}`, ...args);

  const scrollToFirst = useCallback(() => {
    if (pending.length === 0) {
      return;
    }
    const firstId = pending[0]!.id;
    const anchor = document.querySelector<HTMLElement>(`[${PILL_ANCHOR_ATTR}="${firstId}"]`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [pending]);

  if (pending.length === 0) {
    return null;
  }

  const label = pending.length === 1
    ? t('pill-one')
    : t('pill-other', String(pending.length));

  return (
    <button
      type="button"
      onClick={scrollToFirst}
      className={`
        tm:flex tm:items-center tm:gap-1.5 tm:rounded-full tm:border tm:border-yellow
        tm:bg-one-bg2 tm:px-3 tm:py-1 tm:text-xs tm:text-yellow tm:transition-colors
        tm:hover:bg-one-bg3
      `}
    >
      <AlertCircle size={12} className="tm:shrink-0" />
      <span>{label}</span>
    </button>
  );
});
