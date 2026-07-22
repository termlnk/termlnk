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

import type { IIconPickerValue } from '@termlnk/ui';
import type { MouseEvent, PointerEventHandler } from 'react';
import { Button, cn, Popover, PopoverAnchor, PopoverContent, PopoverTrigger, useDependency } from '@termlnk/design';
import { IconBadge, IconPicker, IContextMenuService } from '@termlnk/ui';
import { LayoutGrid, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { TERMINAL_TAB_WORKSPACE_MENU } from '../../services/workspace/contextmenu-positions';
import { IWorkspaceService } from '../../services/workspace/workspace.service';

export interface IWorkspaceTabItemProps {
  className?: string;
  id: string;
  label: string;
  sessionCount: number;
  icon?: IIconPickerValue;
  pinned?: boolean;
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
    id,
    label,
    sessionCount,
    icon,
    pinned,
    isActive,
    isDragging,
    isFloating,
    isMergeTarget,
    tabRef,
    onPointerDown,
    onClick,
    onClose,
  } = props;

  const workspaceService = useDependency(IWorkspaceService);
  const contextMenuService = useDependency(IContextMenuService);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(label);

  // The floating drag preview is display-only: no popover, menu, or inline editing.
  const interactive = !isFloating;

  // Commands (e.g. from the context menu) push one-shot intents through the
  // service; the matching tab item drives the actual UI.
  useEffect(() => {
    if (!interactive) {
      return;
    }
    const subscription = workspaceService.iconPickerRequest$.subscribe((workspaceId) => {
      if (workspaceId === id) {
        setPickerOpen(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [interactive, workspaceService, id]);

  useEffect(() => {
    if (!interactive) {
      return;
    }
    const subscription = workspaceService.renameRequest$.subscribe((workspaceId) => {
      if (workspaceId === id) {
        setDraftName(label);
        setIsEditing(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [interactive, workspaceService, id, label]);

  const handleClose = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    if (!interactive) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    workspaceService.setMenuTarget(id);
    contextMenuService.triggerContextMenu(e.nativeEvent, TERMINAL_TAB_WORKSPACE_MENU);
  };

  const startRename = useCallback(() => {
    setDraftName(label);
    setIsEditing(true);
  }, [label]);

  const commitRename = useCallback(() => {
    workspaceService.renameWorkspace(id, draftName);
    setIsEditing(false);
  }, [workspaceService, id, draftName]);

  const cancelRename = useCallback(() => {
    setDraftName(label);
    setIsEditing(false);
  }, [label]);

  const defaultGlyph = (
    <div className={cn('tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center tm:text-white')}>
      <LayoutGrid size={14} strokeWidth={1.5} />
    </div>
  );
  const iconBadge = <IconBadge icon={icon} fallback={defaultGlyph} />;
  const iconPicker = (
    <PopoverContent
      align="start"
      sideOffset={6}
      className={cn('tm:w-[320px] tm:p-3')}
      // A non-modal popover dismisses itself on ANY focusin outside its content.
      // When the picker is opened from the workspace context menu, the menu's
      // teardown performs programmatic focus moves (react-menu refocuses its
      // content on the synthesized pointerleave when the menu DOM is removed
      // under the cursor, plus close-auto-focus), which are not user outside
      // interactions. Close on pointer-down-outside and Escape only.
      onFocusOutside={(event) => event.preventDefault()}
    >
      <IconPicker
        value={icon}
        onSelect={(value) => {
          workspaceService.setWorkspaceIcon(id, value);
          setPickerOpen(false);
        }}
        onBackgroundChange={(value) => workspaceService.setWorkspaceIcon(id, value)}
        onReset={() => {
          workspaceService.setWorkspaceIcon(id, null);
          setPickerOpen(false);
        }}
      />
    </PopoverContent>
  );
  const iconArea = !interactive
    ? iconBadge
    : pinned
      // Pinned tabs are icon-only, so the icon must not swallow the click that
      // switches the tab: use a plain anchor and let the event bubble up. The
      // picker is opened via the context-menu command (iconPickerRequest$).
      ? (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverAnchor asChild>
            <span className={cn('tm:flex tm:shrink-0 tm:items-center tm:justify-center')}>
              {iconBadge}
            </span>
          </PopoverAnchor>
          {iconPicker}
        </Popover>
      )
      : (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className={cn('tm:flex tm:shrink-0 tm:items-center tm:justify-center tm:rounded-[4px]')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {iconBadge}
            </button>
          </PopoverTrigger>
          {iconPicker}
        </Popover>
      );

  return (
    <div
      ref={tabRef}
      title={label}
      data-tab-item-id={id}
      className={cn(
        `
          tm:group
          tm:relative tm:flex tm:h-full tm:items-center tm:px-1 tm:text-white tm:select-none
          tm:[&+&]:before:absolute tm:[&+&]:before:top-1/4 tm:[&+&]:before:left-0 tm:[&+&]:before:h-1/2
          tm:[&+&]:before:w-px tm:[&+&]:before:bg-line tm:[&+&]:before:opacity-40 tm:[&+&]:before:transition-opacity
          tm:[&+&]:before:duration-150 tm:[&+&]:before:content-['']
        `,
        {
          'tm:max-w-[200px] tm:min-w-[120px]': !pinned || isEditing,
          'tm:opacity-60': isDragging,
        },
        className
      )}
      data-active={isActive}
      data-terminal-tab="true"
      onPointerDown={onPointerDown}
      onClick={onClick}
      onContextMenu={handleContextMenu}
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
        {iconArea}

        {!pinned && !isEditing && (
          <span
            className="tm:flex-1 tm:truncate tm:text-[12px] tm:font-medium tm:text-white"
            onDoubleClick={(e) => {
              if (!interactive) {
                return;
              }
              e.stopPropagation();
              startRename();
            }}
          >
            {label}
          </span>
        )}

        {isEditing && (
          <input
            className={cn(`
              tm:min-w-0 tm:flex-1 tm:rounded-sm tm:bg-black tm:px-1 tm:text-[12px] tm:font-medium tm:text-white
              tm:ring-1 tm:ring-blue tm:outline-none
            `)}
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          />
        )}

        {!pinned && (
          <span className="tm:shrink-0 tm:rounded-sm tm:px-1 tm:text-[10px] tm:text-light-grey">
            {sessionCount}
          </span>
        )}

        {!pinned && (
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
        )}
      </div>
    </div>
  );
}
