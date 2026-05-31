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

import type { MouseEvent, PointerEventHandler } from 'react';
import type { TerminalSessionStatus } from '../../services/terminal/terminal-ui.service';
import { Quantity } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { TooltipWrapper } from '@termlnk/ui';
import { Loader2, Terminal, Users, X } from 'lucide-react';
import { EMPTY } from 'rxjs';
import { CloseActiveTabCommand } from '../../commands/close-active-tab.command';
import { ITerminalViewRegistry } from '../../services/terminal/terminal-view-registry.service';

export interface ITerminalTabItemProps {
  className?: string;
  id: string;
  type: string;
  label: string;
  status: TerminalSessionStatus;
  isActive: boolean;
  isDragging?: boolean;
  isFloating?: boolean;
  isMergeTarget?: boolean;
  tabRef?: (node: HTMLDivElement | null) => void;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onClick?: () => void;
  onClose?: () => void;
}

export function TerminalTabItem(props: ITerminalTabItemProps) {
  const {
    className,
    id,
    type,
    label,
    status,
    isActive,
    isDragging,
    isFloating,
    isMergeTarget,
    tabRef,
    onPointerDown,
    onClick,
    onClose,
  } = props;

  const viewRegistry = useDependency(ITerminalViewRegistry, Quantity.OPTIONAL);
  // Re-render when adornments register/unregister so a late-arriving plugin
  // (e.g. SharedTerminalUIPlugin loaded after the first tab paint) still
  // surfaces its right-side icon.
  useObservable(viewRegistry?.adornmentsChanged$ ?? EMPTY);
  const AdornmentComponent = isFloating ? undefined : viewRegistry?.getTabAdornment(type);

  const handleClose = (e: MouseEvent) => {
    e.stopPropagation();
    onClose?.();
  };

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  const isConnecting = status === 'connecting' || status === 'authenticating' || status === 'opening_shell';
  const isError = status === 'error' || status === 'auth_failed';
  const isReady = status === 'ready';
  const isClosed = status === 'closed' || status === 'idle';

  return (
    <div
      ref={tabRef}
      title={label}
      data-tab-item-id={props.id}
      className={cn(
        `
          tm:group
          tm:relative tm:flex tm:h-full tm:max-w-50 tm:min-w-30 tm:cursor-pointer tm:items-center tm:px-1 tm:text-white
          tm:select-none
          tm:[&+&]:before:absolute tm:[&+&]:before:top-1/4 tm:[&+&]:before:left-0 tm:[&+&]:before:h-1/2
          tm:[&+&]:before:w-px tm:[&+&]:before:bg-line tm:[&+&]:before:opacity-40 tm:[&+&]:before:transition-opacity
          tm:[&+&]:before:duration-150 tm:[&+&]:before:content-['']
        `,
        {
          'tm:opacity-60': isDragging,
        },
        className
      )}
      data-active={isActive}
      data-terminal-tab="true"
      onPointerDown={onPointerDown}
      onClick={handleClick}
    >
      <div
        className={cn(
          `
            tm:flex tm:h-[calc(100%-6px)] tm:w-full tm:items-center tm:gap-1 tm:rounded-lg tm:px-2 tm:transition-all
            tm:duration-150
          `,
          {
            'tm:bg-blue/20': isActive,
            'tm:hover:bg-one-bg': !isActive && !isMergeTarget,
            'tm:scale-[1.02] tm:bg-one-bg2 tm:shadow-[0_6px_14px_rgba(0,0,0,0.24)]': isFloating,
            'tm:bg-blue/10 tm:ring-2 tm:ring-blue/50': isMergeTarget,
          }
        )}
      >
        <div
          className="tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center tm:text-white"
        >
          {type === 'ssh'
            ? (
              <div
                className={cn('tm:size-2 tm:rounded-full', {
                  'tm:bg-green': isReady,
                  'tm:animate-pulse tm:bg-yellow': isConnecting,
                  'tm:bg-red': isError,
                  'tm:bg-grey': isClosed,
                })}
              />
            )
            : type === 'remote'
              ? (
                isConnecting
                  ? (
                    <Loader2
                      size={14}
                      strokeWidth={1.5}
                      className="tm:animate-spin"
                    />
                  )
                  : (
                    <Users
                      size={14}
                      strokeWidth={1.5}
                      className={cn({
                        'tm:text-green': isReady,
                        'tm:text-red': isError,
                        'tm:text-yellow': isClosed,
                      })}
                    />
                  )
              )
              : (isConnecting
                ? <Loader2 size={14} strokeWidth={1.5} className="tm:animate-spin" />
                : <Terminal size={14} strokeWidth={1.5} />)}
        </div>

        <span
          className="tm:flex-1 tm:truncate tm:text-[12px]/4 tm:font-medium tm:text-white"
        >
          {label}
        </span>

        {AdornmentComponent && (
          <AdornmentComponent sessionId={id} />
        )}

        <TooltipWrapper
          side="bottom"
          labelKey="terminal-ui.tab-bar.close-session"
          commandId={CloseActiveTabCommand.id}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              `
                tm:flex tm:size-4.5 tm:shrink-0 tm:bg-transparent
                tm:hover:bg-transparent
              `,
              {
                'tm:text-light-grey tm:opacity-100': isActive,
                'tm:scale-90 tm:text-grey-fg tm:opacity-0 tm:group-hover:scale-100 tm:group-hover:opacity-100': !isActive,
              }
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClose}
          >
            <X size={12} strokeWidth={1.5} />
          </Button>
        </TooltipWrapper>
      </div>
    </div>
  );
}
