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

import type { IPermissionRequestPayload } from '@termlnk/island';
import { LocaleService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { toPermissionViewModel } from '@termlnk/island';
import { useCallback, useMemo } from 'react';
import { IPermissionRequestService } from '../../services/permission-request.service';
import { usePermissionKeyboard } from '../hooks/use-permission-keyboard';
import { ToolContentView } from './ToolContentView';

/**
 * Pure renderer for the active permission request. AskUserQuestion no
 * longer surfaces here — those pending interactions only drive the pet's
 * Question animation state; each agent's CLI TUI handles the pick.
 */
export function PermissionRequestView({ request }: { request: IPermissionRequestPayload }) {
  const permissionService = useDependency(IPermissionRequestService);
  const localeService = useDependency(LocaleService);

  const viewModel = useMemo(() => toPermissionViewModel(request), [request]);

  const onAllow = useCallback(() => permissionService.allow(request.requestId), [permissionService, request.requestId]);
  const onDeny = useCallback(() => permissionService.deny(request.requestId), [permissionService, request.requestId]);

  usePermissionKeyboard(request.requestId, onAllow, onDeny);

  return (
    <>
      <div
        className={cn('tm:flex tm:items-center tm:gap-1.5')}
        style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}
      >
        <div
          className={cn('tm:shrink-0 tm:rounded-full')}
          style={{
            width: 6,
            height: 6,
            background: 'var(--color-alert, #f97316)',
            animation: 'vi-pulse 1.5s ease infinite',
          }}
        />
        <span className={cn('tm:flex-1')}>{localeService.t('island-ui.permission.permission-request')}</span>
        {request.source === 'external' && (
          <span
            className={cn('tm:shrink-0 tm:rounded-sm')}
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            {localeService.t('island-ui.permission.external')}
          </span>
        )}
      </div>

      <div className={cn('tm:flex tm:items-center tm:gap-1.5')}>
        <span style={{ fontSize: 11, color: 'var(--color-alert, #f97316)' }}>&#9888;</span>
        <span
          className={cn('tm:font-mono')}
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-alert, #f97316)' }}
        >
          {request.toolName}
        </span>
        {viewModel.primaryTarget && (
          <span
            className={cn('tm:truncate tm:font-mono')}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}
          >
            {viewModel.primaryTarget}
          </span>
        )}
      </div>

      <ToolContentView toolName={request.toolName} toolInput={request.toolInput} />

      <div className={cn('tm:mt-auto tm:flex tm:gap-1.5 tm:pt-1 tm:pb-2.5')}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeny();
          }}
          className={cn('tm:flex-1 tm:border-none')}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 500,
            background: 'rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          {localeService.t('island-ui.permission.deny')}
          {' '}
          <kbd className={cn('tm:font-mono')} style={{ fontSize: 8, opacity: 0.5 }}>&#8984;N</kbd>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAllow();
          }}
          className={cn('tm:flex-1 tm:border-none')}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 500,
            background: 'rgba(255,255,255,0.9)',
            color: '#000',
          }}
        >
          {localeService.t('island-ui.permission.allow')}
          {' '}
          <kbd className={cn('tm:font-mono')} style={{ fontSize: 8, opacity: 0.5 }}>&#8984;Y</kbd>
        </button>
      </div>
    </>
  );
}
