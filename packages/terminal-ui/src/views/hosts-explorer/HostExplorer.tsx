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

import type { DragTarget, ItemInstance } from '@headless-tree/core';
import type { HostItem, IHostGroup } from '@termlnk/terminal';
import type { FocusEvent, MouseEvent } from 'react';
import type { IToggleHostDialogParams } from '../../commands/toggle-host-dialog.command';
import { asyncDataLoaderFeature, dragAndDropFeature, hotkeysCoreFeature, renamingFeature, selectionFeature } from '@headless-tree/core';
import { AssistiveTreeDescription, useTree } from '@headless-tree/react';
import { ICommandService, LocaleService } from '@termlnk/core';
import { Button, useDependency } from '@termlnk/design';
import { IHostManagerService } from '@termlnk/rpc-client';
import { DEFAULT_HOST_ROOT, HostType } from '@termlnk/terminal';
import { TooltipWrapper } from '@termlnk/ui';
import { CirclePlus, FolderPlus, RotateCw } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { debounceTime } from 'rxjs';
import { ToggleHostDialogCommand } from '../../commands/toggle-host-dialog.command';
import { HostDialogMode } from '../../models/host-dialog.state';
import { InlineGroupInput } from './GroupInput';
import { TreeItem } from './TreeItem';

export function HostExplorer() {
  const hostsManagerService = useDependency(IHostManagerService);
  const localeService = useDependency(LocaleService);
  const commandService = useDependency(ICommandService);

  const [loadingItemData, setLoadingItemData] = useState<string[]>([]);
  const [loadingItemChildrens, setLoadingItemChildrens] = useState<string[]>([]);
  const [expandedItems, setExpandedItemsState] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [treeFocused, setTreeFocused] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState<{ parentId: string; level: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hostsManagerService.getExpandedIds().then((expands) => {
      setExpandedItemsState(expands);
    });
  }, [hostsManagerService]);

  const setExpandedItems = useCallback((itemsOrUpdate: string[] | ((prev: string[]) => string[])) => {
    setExpandedItemsState((prev) => {
      const newItems = typeof itemsOrUpdate === 'function' ? itemsOrUpdate(prev) : itemsOrUpdate;
      hostsManagerService.setExpandedIds(newItems);
      return newItems;
    });
  }, [hostsManagerService]);

  const tree = useTree<HostItem>({
    state: { loadingItemData, loadingItemChildrens, expandedItems, selectedItems, focusedItem },
    setLoadingItemData,
    setLoadingItemChildrens,
    setExpandedItems,
    setSelectedItems,
    setFocusedItem,
    rootItemId: DEFAULT_HOST_ROOT,
    getItemName: (item: ItemInstance<HostItem>) => item.getItemData().label,
    isItemFolder: (item: ItemInstance<HostItem>) => item.getItemData().type === HostType.GROUP,
    canReorder: true,
    createLoadingItemData: () => {
      return {
        id: 'loading',
        label: 'Loading...',
        type: HostType.UNKNOWN,
        pid: '',
        sort: 0,
      };
    },
    onRename: async (item: ItemInstance<HostItem>, newName: string) => {
      const { id, type } = item.getItemData();
      await hostsManagerService.update({ id, label: newName, type } as HostItem);
      item.invalidateItemData();
    },
    onDrop: async (items: ItemInstance<HostItem>[], target: DragTarget<HostItem>) => {
      const isOrderedTarget = 'childIndex' in target;

      let targetParentId: string;
      let insertionIndex: number;

      if (isOrderedTarget) {
        // 排序拖拽（在节点之间）：target.item 是父节点
        targetParentId = target.item.getId();
        insertionIndex = target.insertionIndex as number;
      } else if (target.item.isFolder()) {
        // 放入文件夹：移到文件夹内的开头
        targetParentId = target.item.getId();
        insertionIndex = 0;
      } else {
        // 放到非文件夹节点上：作为兄弟节点，放在目标后面
        const meta = target.item.getItemMeta();
        targetParentId = meta.parentId || DEFAULT_HOST_ROOT;
        insertionIndex = target.item.getItemData().sort + 1;
      }

      // 收集需要刷新的父节点（源父节点 + 目标父节点）
      const parentsToRefresh = new Set<string>();
      parentsToRefresh.add(targetParentId);
      for (const item of items) {
        const originalParentId = item.getItemMeta().parentId;
        parentsToRefresh.add(originalParentId || DEFAULT_HOST_ROOT);
      }

      try {
        for (let i = 0; i < items.length; i++) {
          await hostsManagerService.move(items[i].getId(), targetParentId, insertionIndex + i);
        }
      } catch (err) {
        console.error('[HostExplorer] onDrop move failed:', err);
      }

      // 放入文件夹时，确保目标展开以显示结果
      if (!isOrderedTarget && target.item.isFolder() && !target.item.isExpanded()) {
        target.item.expand();
      }

      await Promise.all(items.map((item) => item.invalidateItemData()));
      await Promise.all(
        Array.from(parentsToRefresh, (parentId) => {
          const instance = tree.getItemInstance(parentId);
          return instance?.invalidateChildrenIds();
        })
      );
    },
    dataLoader: {
      getItem: async (id: string): Promise<HostItem> => {
        if (id === DEFAULT_HOST_ROOT) {
          return { id: DEFAULT_HOST_ROOT, label: 'Root', type: HostType.GROUP, pid: '', sort: 0 } as HostItem;
        }
        return hostsManagerService.getInfo(id);
      },
      getChildren: async (id: string): Promise<string[]> => {
        const list = await hostsManagerService.getChildrenList(id);
        return list.map((v) => v.id);
      },
    },
    indent: 20,
    hotkeys: {
      customEnterRename: {
        hotkey: 'Enter',
        handler: (_e, tree) => {
          const focusedItem = tree.getFocusedItem();
          if (focusedItem && !focusedItem.isRenaming()) {
            focusedItem.startRenaming();
          }
        },
      },
    },
    features: [
      asyncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature,
      renamingFeature,
    ],
  });

  useEffect(() => {
    const subscription = hostsManagerService.onChanged$().pipe(
      debounceTime(50)
    ).subscribe((event) => {
      if (event.type === 'update') {
        tree.getItemInstance(event.id)?.invalidateItemData();
      } else {
        tree.getItemInstance(event.pid)?.invalidateChildrenIds();
        if (event.type === 'move') {
          tree.getItemInstance(event.id)?.invalidateItemData();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [hostsManagerService, tree]);

  const addHost = () => {
    const item = tree.getFocusedItem();

    let parentId;
    if (item?.getItemData()?.type === HostType.GROUP) {
      parentId = item.getId();
    }
    const params: IToggleHostDialogParams = {
      mode: HostDialogMode.CREATE,
      parentId,
    };
    commandService.executeCommand(ToggleHostDialogCommand.id, params);
  };

  const addGroup = () => {
    let parentId = DEFAULT_HOST_ROOT;
    let level = 0;

    if (focusedItem) {
      const item = tree.getItemInstance(focusedItem);
      if (item) {
        const itemData = item.getItemData();
        const itemMeta = item.getItemMeta();
        if (itemData.type === HostType.GROUP) {
          parentId = item.getId();
          level = itemMeta.level + 1;
          if (!item.isExpanded()) {
            item.expand();
          }
        } else if (itemData.type === HostType.HOST) {
          if (itemMeta?.parentId !== DEFAULT_HOST_ROOT) {
            const parentItem = tree.getItemInstance(itemMeta.parentId);
            if (parentItem) {
              level = parentItem.getItemMeta().level + 1;
              if (!parentItem.isExpanded()) {
                parentItem.expand();
              }
            }
          }
        }
      }
    }

    // Entering inline create mode should not keep the parent item in selected/focused visual state.
    setSelectedItems([]);
    setFocusedItem(null);
    setNewGroupInput({ parentId, level });
  };

  const handleConfirmNewGroup = async (name: string) => {
    if (!newGroupInput) return;
    const { parentId } = newGroupInput;
    setNewGroupInput(null);
    const newId = await hostsManagerService.create({
      label: name,
      type: HostType.GROUP,
      pid: parentId,
    } as IHostGroup);
    await tree.getItemInstance(parentId)?.invalidateChildrenIds();
    setFocusedItem(newId);
    setSelectedItems([newId]);
  };

  const handleCancelNewGroup = () => {
    setNewGroupInput(null);
  };

  const refresh = async () => {
    // 递归刷新所有已展开的节点及其子节点
    const refreshItem = async (item: ItemInstance<HostItem>) => {
      await item.invalidateItemData();
      await item.invalidateChildrenIds();
      // 如果节点已展开，递归刷新其子节点
      if (item.isExpanded()) {
        const children = item.getChildren();
        for (const child of children) {
          await refreshItem(child);
        }
      }
    };

    const root = tree.getRootItem();
    await refreshItem(root);
  };

  const handleContainerBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setTreeFocused(false);
    }
  }, []);

  const handleContainerFocus = useCallback((e: FocusEvent<HTMLDivElement>) => {
    if (containerRef.current && containerRef.current.contains(e.target as Node)) {
      setTreeFocused(true);
    }
  }, []);

  const handleTreeBodyMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      // Clicked the blank area inside HostExplorer: clear both selected and focused states.
      setSelectedItems([]);
      setFocusedItem(null);
    }
  }, []);

  useEffect(() => {
    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        // Clicked outside HostExplorer: clear selected state, keep focused state.
        setSelectedItems([]);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown, true);
  }, []);

  const treeContainerProps = tree.getContainerProps();

  return (
    <div
      key="hosts-explorer"
      ref={containerRef}
      className="tm:flex tm:size-full tm:flex-col"
      onBlur={handleContainerBlur}
      onFocus={handleContainerFocus}
    >
      <div
        key="hosts-explorer-header"
        className={`
          tm:box-border tm:flex tm:h-10 tm:w-full tm:flex-row tm:items-center tm:px-2 tm:text-[12px] tm:font-normal
          tm:select-none
        `}
      >
        <div
          className="tm:flex tm:size-full tm:items-center tm:truncate tm:overflow-hidden"
        >
          {localeService.t('terminal-ui.hosts-explorer.title')}
        </div>
        <div
          className="tm:flex tm:h-full tm:min-w-17 tm:items-center"
        >
          <TooltipWrapper
            side="bottom"
            labelKey="terminal-ui.hosts-explorer.add-host"
            commandId={ToggleHostDialogCommand.id}
          >
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => addHost()}
            >
              <CirclePlus strokeWidth={1.5} size={14} />
            </Button>
          </TooltipWrapper>
          <TooltipWrapper
            side="bottom"
            labelKey="terminal-ui.hosts-explorer.add-group"
          >
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => addGroup()}
            >
              <FolderPlus strokeWidth={1.5} size={14} />
            </Button>
          </TooltipWrapper>
          <TooltipWrapper
            side="bottom"
            labelKey="terminal-ui.hosts-explorer.refresh"
          >
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => refresh()}
            >
              <RotateCw strokeWidth={1.5} size={14} />
            </Button>
          </TooltipWrapper>
        </div>
      </div>

      <div
        key="hosts-explorer-body"
        {...treeContainerProps}
        onMouseDown={(e) => {
          treeContainerProps.onMouseDown?.(e);
          handleTreeBodyMouseDown(e);
        }}
        className="tm:flex tm:size-full tm:flex-col tm:overflow-visible tm:select-none"
      >
        <AssistiveTreeDescription key="hosts-explorer-desc" tree={tree} />

        {newGroupInput?.parentId === DEFAULT_HOST_ROOT && (
          <InlineGroupInput
            level={0}
            onConfirm={handleConfirmNewGroup}
            onCancel={handleCancelNewGroup}
          />
        )}

        {tree.getItems().map((item) => (
          <Fragment key={item.getId()}>
            <TreeItem
              item={item}
              focusedItemId={focusedItem}
              treeFocused={treeFocused}
              suppressSelectionStyle={Boolean(newGroupInput)}
            />
            {newGroupInput?.parentId === item.getId() && (
              <InlineGroupInput
                level={newGroupInput.level}
                onConfirm={handleConfirmNewGroup}
                onCancel={handleCancelNewGroup}
              />
            )}
          </Fragment>
        ))}

        <div
          key="hosts-explorer-dragline"
          className="tm:-mt-px tm:h-0.5 tm:rounded-full tm:bg-blue"
          style={tree.getDragLineStyle()}
        />
      </div>
    </div>
  );
}
