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
import { Button, cn } from '@termlnk/design';
import { LayoutGrid, X } from 'lucide-react';

export interface IWorkspaceTabItemProps {
  className?: string;
  id: string;
  label: string;
  sessionCount: number;
  isActive: boolean;
  isDragging?: boolean;
  isFloating?: boolean;
  isMergeTarget?: boolean;
  tabRef?: (node: HTMLDivElement | null) => void;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onClick: () => void;
  onClose: () => void;
}

export function WorkspaceTabItem(props: IWorkspaceTabItemProps) {
  const {
    className,
    label,
    sessionCount,
    isActive,
    isDragging,
    isFloating,
    isMergeTarget,
    tabRef,
    onPointerDown,
    onClick,
    onClose,
  } = props;

  const handleClose = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      ref={tabRef}
      title={label}
      data-tab-item-id={props.id}
      className={cn(
        `
          tm:group
          tm:relative tm:flex tm:h-full tm:max-w-[200px] tm:min-w-[120px] tm:cursor-pointer tm:items-center tm:px-1
          tm:text-white tm:select-none
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
      onClick={onClick}
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
          <LayoutGrid size={14} strokeWidth={1.5} />
        </div>

        <span
          className="tm:flex-1 tm:truncate tm:text-[12px] tm:font-medium tm:text-white"
        >
          {label}
        </span>

        <span className="tm:shrink-0 tm:rounded-sm tm:px-1 tm:text-[10px] tm:text-light-grey">
          {sessionCount}
        </span>

        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            `
              tm:flex tm:size-4.5 tm:shrink-0 tm:bg-transparent
              tm:hover:bg-transparent tm:hover:text-white
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
      </div>
    </div>
  );
}
