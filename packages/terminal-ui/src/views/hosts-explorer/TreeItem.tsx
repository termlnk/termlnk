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

import type { ItemInstance } from '@headless-tree/core';
import type { HostItem } from '@termlnk/terminal';
import type { MouseEvent } from 'react';
import { ICommandService } from '@termlnk/core';
import { cn, useDependency } from '@termlnk/design';
import { HostType } from '@termlnk/terminal';
import { IContextMenuService } from '@termlnk/ui';
import { ChevronRight, Folder, FolderOpen, Pencil, TerminalSquare } from 'lucide-react';
import { Fragment } from 'react';
import { ConnectHostCommand } from '../../commands/connect-host.command';
import { ToggleHostDialogCommand } from '../../commands/toggle-host-dialog.command';
import { HostDialogMode } from '../../models/host-dialog.state';
import { HOSTS_EXPLORER_FOLDER_ITEM_MENU, HOSTS_EXPLORER_HOST_ITEM_MENU } from '../../services/hosts-explorer/contextmenu-positions';
import { IHostExplorerService } from '../../services/hosts-explorer/hosts-explorer.service';

export interface ITreeItemProps {
  item: ItemInstance<HostItem>;
  focusedItemId?: string | null;
  treeFocused?: boolean;
  suppressSelectionStyle?: boolean;
}

export function TreeItem(props: ITreeItemProps) {
  const { item, focusedItemId, treeFocused, suppressSelectionStyle = false } = props;
  const commandService = useDependency(ICommandService);
  const contextMenuService = useDependency(IContextMenuService);
  const hostExplorerService = useDependency(IHostExplorerService);
  const itemData = item.getItemData();

  if (item.isRenaming()) {
    return <TreeItemRenaming item={item} />;
  }

  const handleEdit = (e: MouseEvent) => {
    e.stopPropagation();

    if (itemData.type === HostType.HOST) {
      commandService.executeCommand(ToggleHostDialogCommand.id, {
        mode: HostDialogMode.EDIT,
        hostId: itemData.id,
      });
    } else if (itemData.type === HostType.GROUP) {
      item.startRenaming();
    }
  };

  const itemProps = item.getProps();

  const handleClick = (e: MouseEvent) => {
    itemProps.onClick?.(e as any);

    if (itemData.type === HostType.HOST) {
      commandService.executeCommand(ConnectHostCommand.id, {
        hostId: itemData.id,
      });
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (itemData.type === HostType.UNKNOWN) {
      return;
    }

    item.setFocused();
    item.select();

    // Publish focus before opening — menu items read `focusedHost$` when
    // evaluating `disabled$` at render time.
    hostExplorerService.setFocusedHost(itemData);

    const menuType = itemData.type === HostType.GROUP
      ? HOSTS_EXPLORER_FOLDER_ITEM_MENU
      : HOSTS_EXPLORER_HOST_ITEM_MENU;

    contextMenuService.triggerContextMenu(e.nativeEvent, menuType);
  };

  const isSelected = item.isSelected();
  const isFocusedItem = focusedItemId === item.getId();
  const isActiveSelected = !suppressSelectionStyle && treeFocused && isSelected;
  const shouldShowFocusStyle = !suppressSelectionStyle && isFocusedItem && !isSelected;
  const shouldShowBlurredSelectionStyle = !suppressSelectionStyle && !treeFocused && isSelected;

  return (
    <div
      key={item.getId()}
      {...itemProps}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(`
        tm:group
        tm:relative tm:box-border tm:flex tm:h-[22px] tm:w-full tm:cursor-pointer tm:flex-row tm:items-center
        tm:leading-[22px]
        tm:hover:bg-one-bg
      `, {
        'tm:bg-one-bg2': shouldShowFocusStyle || shouldShowBlurredSelectionStyle,
        'tm:ring-1 tm:ring-blue tm:ring-inset': isActiveSelected,
        'tm:bg-blue': item.isDragTarget(),
      })}
      style={{
        paddingLeft: `${item.getItemMeta().level * 15}px`,
        ...(isActiveSelected ? { backgroundColor: 'color-mix(in srgb, var(--tm-blue) 15%, transparent)' } : {}),
      }}
    >
      <TreeItemIcon item={item} />
      <div
        key="hosts-explorer-title"
        className="tm:flex tm:min-w-0 tm:flex-1 tm:items-center tm:truncate tm:text-[13px]"
      >
        {item.getItemName()}
      </div>

      {/* Edit button - visible on hover */}
      <button
        type="button"
        onClick={handleEdit}
        className="
          tm:mr-2 tm:opacity-0 tm:transition-opacity
          tm:group-hover:opacity-100
        "
      >
        <Pencil strokeWidth={1.5} size={12} />
      </button>
    </div>
  );
}

function TreeItemIcon({ item }: ITreeItemProps) {
  return (
    <div className="tm:mr-1.5 tm:flex tm:h-full tm:items-center">
      {item.isFolder() && (
        <Fragment>
          <ChevronRight
            strokeWidth={1}
            className={cn('tm:mr-0.5 tm:size-[16px] tm:transition-all tm:duration-250 tm:ease-in-out', {
              'tm:rotate-90': item.isExpanded(),
            })}
          />
          {!item.isExpanded() && <Folder strokeWidth={1} className="tm:size-[14px]" />}
          {item.isExpanded() && <FolderOpen strokeWidth={1} className="tm:size-[14px]" />}
        </Fragment>
      )}
      {!item.isFolder() && (
        <div className="tm:ml-[18px] tm:flex tm:h-full tm:items-center">
          <TerminalSquare strokeWidth={1} className="tm:size-[14px] tm:text-green" />
        </div>
      )}
    </div>
  );
}

function TreeItemRenaming(props: ITreeItemProps) {
  const { item } = props;

  return (
    <div
      key={item.getId()}
      className={cn(`
        tm:relative tm:box-border tm:flex tm:h-[22px] tm:w-full tm:flex-row tm:items-center tm:bg-one-bg3
        tm:leading-[22px]
      `)}
      style={{ paddingLeft: `${item.getItemMeta().level * 15}px` }}
    >
      <TreeItemIcon item={item} />
      <input
        {...item.getRenameInputProps()}
        className={cn(`
          tm:h-[18px] tm:min-w-0 tm:flex-1 tm:rounded-xs tm:border tm:border-blue tm:bg-one-bg3 tm:px-1 tm:text-[13px]
          tm:outline-hidden
        `)}
      />
    </div>
  );
}
