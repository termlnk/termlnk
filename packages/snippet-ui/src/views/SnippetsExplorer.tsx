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
import type { ISnippet, ISnippetPackage, ISnippetService as ISnippetServiceType, SnippetItem } from '@termlnk/snippet';
import type { FC, KeyboardEvent, MouseEvent } from 'react';
import { asyncDataLoaderFeature, dragAndDropFeature, hotkeysCoreFeature, renamingFeature, selectionFeature } from '@headless-tree/core';
import { AssistiveTreeDescription, useTree } from '@headless-tree/react';
import { ILogService, LocaleService } from '@termlnk/core';
import { Button, cn, useDependency } from '@termlnk/design';
import { DEFAULT_SNIPPET_ROOT, ISnippetService, SnippetType } from '@termlnk/snippet';
import { IContextMenuService, TooltipWrapper } from '@termlnk/ui';
import { Braces, ChevronDown, ChevronRight, CirclePlus, FolderPlus, Package } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { buffer, debounceTime, filter, share } from 'rxjs';
import { PACKAGE_CONTEXT_MENU, SNIPPET_CONTEXT_MENU } from '../controllers/snippet-context.menu';
import { ISnippetContextService } from '../services/snippet-context/snippet-context.service';
import { ISnippetDialogService } from '../services/snippet-dialog.service';

export const SNIPPETS_EXPLORER_NAME_COMPONENT = 'snippet-ui.component.snippets-explorer';

export const SnippetsExplorer: FC = () => {
  const snippetService = useDependency(ISnippetService) as ISnippetServiceType;
  const snippetDialog = useDependency(ISnippetDialogService);
  const localeService = useDependency(LocaleService);
  const snippetContextService = useDependency(ISnippetContextService);
  const logService = useDependency(ILogService);

  const [loadingItemData, setLoadingItemData] = useState<string[]>([]);
  const [loadingItemChildrens, setLoadingItemChildrens] = useState<string[]>([]);
  const [expandedItems, setExpandedItemsState] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [treeFocused, setTreeFocused] = useState(false);
  const [treeEmpty, setTreeEmpty] = useState(false);
  const [childCountMap, setChildCountMap] = useState<Record<string, number>>({});
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [creatingPackagePid, setCreatingPackagePid] = useState<string>(DEFAULT_SNIPPET_ROOT);

  const containerRef = useRef<HTMLDivElement>(null);

  const t = useCallback((k: string) => localeService.t(k), [localeService]);

  useEffect(() => {
    snippetService.getExpandedPackageIds().then((ids) => {
      setExpandedItemsState(ids);
    });
  }, [snippetService]);

  const setExpandedItems = useCallback((itemsOrUpdate: string[] | ((prev: string[]) => string[])) => {
    setExpandedItemsState((prev) => {
      const newItems = typeof itemsOrUpdate === 'function' ? itemsOrUpdate(prev) : itemsOrUpdate;
      void snippetService.setExpandedPackageIds(newItems);
      return newItems;
    });
  }, [snippetService]);

  const tree = useTree<SnippetItem>({
    state: { loadingItemData, loadingItemChildrens, expandedItems, selectedItems, focusedItem },
    setLoadingItemData,
    setLoadingItemChildrens,
    setExpandedItems,
    setSelectedItems,
    setFocusedItem,
    rootItemId: DEFAULT_SNIPPET_ROOT,
    getItemName: (item: ItemInstance<SnippetItem>) => item.getItemData().label,
    isItemFolder: (item: ItemInstance<SnippetItem>) => item.getItemData().type === SnippetType.PACKAGE,
    canReorder: true,
    createLoadingItemData: () => ({
      id: 'loading',
      label: 'Loading...',
      type: SnippetType.PACKAGE,
      pid: '',
      sort: 0,
      expanded: false,
    } as SnippetItem),
    onRename: async (item: ItemInstance<SnippetItem>, newName: string) => {
      const data = item.getItemData();
      if (data.type === SnippetType.PACKAGE) {
        await snippetService.updatePackage(data.id, { label: newName });
        item.invalidateItemData();
      }
    },
    onDrop: async (items: ItemInstance<SnippetItem>[], target: DragTarget<SnippetItem>) => {
      const isOrderedTarget = 'childIndex' in target;

      let targetParentId: string;
      let insertionIndex: number;

      if (isOrderedTarget) {
        targetParentId = target.item.getId();
        insertionIndex = target.insertionIndex as number;
      } else if (target.item.isFolder()) {
        targetParentId = target.item.getId();
        insertionIndex = 0;
      } else {
        const meta = target.item.getItemMeta();
        targetParentId = meta.parentId || DEFAULT_SNIPPET_ROOT;
        insertionIndex = target.item.getItemData().sort + 1;
      }

      const parentsToRefresh = new Set<string>();
      parentsToRefresh.add(targetParentId);
      for (const item of items) {
        const originalParentId = item.getItemMeta().parentId;
        parentsToRefresh.add(originalParentId || DEFAULT_SNIPPET_ROOT);
      }

      try {
        for (let i = 0; i < items.length; i++) {
          await snippetService.move(items[i].getId(), targetParentId, insertionIndex + i);
        }
      } catch (err) {
        logService.error('[SnippetsExplorer] onDrop move failed:', err);
      }

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
      getItem: async (id: string): Promise<SnippetItem> => {
        if (id === DEFAULT_SNIPPET_ROOT) {
          return {
            id: DEFAULT_SNIPPET_ROOT,
            label: 'Root',
            type: SnippetType.PACKAGE,
            pid: '',
            sort: 0,
            expanded: true,
          } as SnippetItem;
        }
        const item = await snippetService.getItem(id);
        return item!;
      },
      getChildren: async (id: string): Promise<string[]> => {
        const list = await snippetService.getChildrenList(id);
        setTreeEmpty(id === DEFAULT_SNIPPET_ROOT && list.length === 0);

        const countEntries: Array<[string, number]> = [[id, list.length]];

        // Eagerly preload children counts for all package-type items so
        // collapsed packages always display the correct count.
        const childPackages = list.filter((item) => item.type === SnippetType.PACKAGE);
        if (childPackages.length > 0) {
          const childCounts = await Promise.all(
            childPackages.map((pkg) =>
              snippetService.getChildrenList(pkg.id).then((children) => [pkg.id, children.length] as [string, number])
            )
          );
          countEntries.push(...childCounts);
        }

        setChildCountMap((prev) => {
          const next = { ...prev };
          for (const [pkgId, count] of countEntries) {
            next[pkgId] = count;
          }
          return next;
        });

        return list.map((v) => v.id);
      },
    },
    indent: 16,
    hotkeys: {
      customEnterRename: {
        hotkey: 'Enter',
        handler: (_e, tree) => {
          const item = tree.getFocusedItem();
          if (item && !item.isRenaming() && item.getItemData().type === SnippetType.PACKAGE) {
            item.startRenaming();
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

  // Rename request from context menu command
  useEffect(() => {
    const subscription = snippetContextService.packageRenameRequest$.subscribe((pkgId) => {
      const instance = tree.getItemInstance(pkgId);
      if (!instance || instance.isRenaming()) {
        return;
      }
      instance.setFocused();
      instance.startRenaming();
    });
    return () => subscription.unsubscribe();
  }, [snippetContextService, tree]);

  // Create package request from context menu command
  const addPackageRef = useRef<() => void>(() => {});
  useEffect(() => {
    const subscription = snippetContextService.createPackageRequest$.subscribe(() => {
      addPackageRef.current();
    });
    return () => subscription.unsubscribe();
  }, [snippetContextService]);

  // Mirror focused item to ISnippetContextService
  useEffect(() => {
    if (!focusedItem) {
      return;
    }
    const data = tree.getItemInstance(focusedItem)?.getItemData();
    if (!data) {
      return;
    }
    if (data.type === SnippetType.SNIPPET) {
      snippetContextService.setTarget(data as ISnippet);
    } else if (data.type === SnippetType.PACKAGE) {
      snippetContextService.setPackageTarget(data as ISnippetPackage);
    }
  }, [focusedItem, snippetContextService, tree]);

  // React to remote changes (cloud sync, other windows)
  useEffect(() => {
    const changed$ = snippetService.onChanged$().pipe(share());
    const subscription = changed$.pipe(
      buffer(changed$.pipe(debounceTime(50))),
      filter((events) => events.length > 0)
    ).subscribe((events) => {
      const childrenToRefresh = new Set<string>();
      const dataToRefresh = new Set<string>();
      for (const event of events) {
        if (event.action === 'update') {
          dataToRefresh.add(event.id);
        } else {
          childrenToRefresh.add(event.pid);
          if (event.action === 'move') {
            dataToRefresh.add(event.id);
            if (event.oldPid) {
              childrenToRefresh.add(event.oldPid);
            }
          }
        }
      }
      // Always refresh root to guarantee tree consistency — the cost is one
      // extra getChildren('root') call per batch, which is cheap.
      childrenToRefresh.add(DEFAULT_SNIPPET_ROOT);
      for (const id of dataToRefresh) {
        tree.getItemInstance(id)?.invalidateItemData();
      }
      for (const pid of childrenToRefresh) {
        tree.getItemInstance(pid)?.invalidateChildrenIds();
      }
    });
    return () => subscription.unsubscribe();
  }, [snippetService, tree]);

  const handleAdd = (): void => {
    snippetDialog.openCreate();
  };

  const handleAddPackage = (): void => {
    let parentId = DEFAULT_SNIPPET_ROOT;

    if (focusedItem) {
      const item = tree.getItemInstance(focusedItem);
      if (item) {
        const data = item.getItemData();
        if (data.type === SnippetType.PACKAGE) {
          parentId = item.getId();
          if (!item.isExpanded()) {
            item.expand();
          }
        }
      }
    }

    setSelectedItems([]);
    setFocusedItem(null);
    setCreatingPackage(true);
    setCreatingPackagePid(parentId);
  };
  addPackageRef.current = handleAddPackage;

  const handleCreatePackageConfirm = async (name: string): Promise<void> => {
    setCreatingPackage(false);
    await snippetService.createPackage({ label: name, pid: creatingPackagePid, sort: 0 });
    await tree.getItemInstance(creatingPackagePid)?.invalidateChildrenIds();
  };

  const handleContainerBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setTreeFocused(false);
    }
  }, []);

  const handleContainerFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (containerRef.current && containerRef.current.contains(e.target as Node)) {
      setTreeFocused(true);
    }
  }, []);

  const handleTreeBodyMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSelectedItems([]);
      setFocusedItem(null);
    }
  }, []);

  useEffect(() => {
    const handleDocumentMouseDown = (event: globalThis.MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setSelectedItems([]);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown, true);
  }, []);

  const treeContainerProps = tree.getContainerProps();

  return (
    <div
      key="snippets-explorer"
      ref={containerRef}
      className="tm:flex tm:size-full tm:flex-col tm:bg-black2 tm:text-light-grey"
      onBlur={handleContainerBlur}
      onFocus={handleContainerFocus}
    >
      {/* Header */}
      <div
        className={cn(`
          tm:box-border tm:flex tm:h-10 tm:w-full tm:flex-row tm:items-center tm:px-2 tm:text-[12px] tm:font-normal
          tm:select-none
        `)}
      >
        <div className="tm:flex tm:size-full tm:items-center tm:truncate tm:overflow-hidden tm:text-white">
          {t('snippet-ui.menu.snippets')}
        </div>
        <TooltipWrapper
          side="bottom"
          labelKey="snippet-ui.explorer.newPackage"
        >
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleAddPackage}
          >
            <FolderPlus strokeWidth={1.5} size={14} />
          </Button>
        </TooltipWrapper>
        <TooltipWrapper
          side="bottom"
          labelKey="snippet-ui.explorer.newSnippet"
        >
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleAdd}
          >
            <CirclePlus strokeWidth={1.5} size={14} />
          </Button>
        </TooltipWrapper>
      </div>

      {/* Content */}
      {treeEmpty && !creatingPackage
        ? (
          <div
            className={cn(`
              tm:flex tm:flex-1 tm:flex-col tm:items-center tm:justify-center tm:gap-2 tm:p-6 tm:text-center
              tm:text-grey-fg
            `)}
          >
            <Braces className="tm:size-10 tm:opacity-40" />
            <span className="tm:text-sm">{t('snippet-ui.explorer.empty')}</span>
          </div>
        )
        : (
          <div
            {...treeContainerProps}
            onMouseDown={(e) => {
              treeContainerProps.onMouseDown?.(e);
              handleTreeBodyMouseDown(e);
            }}
            className="tm:flex tm:size-full tm:flex-col tm:gap-1.5 tm:overflow-y-auto tm:px-2 tm:pb-2 tm:select-none"
          >
            <AssistiveTreeDescription key="snippets-explorer-desc" tree={tree} />

            {creatingPackage && creatingPackagePid === DEFAULT_SNIPPET_ROOT && (
              <InlinePackageInput
                depth={0}
                onConfirm={handleCreatePackageConfirm}
                onCancel={() => setCreatingPackage(false)}
              />
            )}

            {tree.getItems().map((item) => (
              <Fragment key={item.getId()}>
                <SnippetTreeItem
                  item={item}
                  focusedItemId={focusedItem}
                  treeFocused={treeFocused}
                  snippetDialog={snippetDialog}
                  suppressSelectionStyle={creatingPackage}
                  childCount={childCountMap[item.getId()]}
                />
                {creatingPackage && creatingPackagePid === item.getId() && (
                  <InlinePackageInput
                    depth={(item.getItemMeta().level + 1)}
                    onConfirm={handleCreatePackageConfirm}
                    onCancel={() => setCreatingPackage(false)}
                  />
                )}
              </Fragment>
            ))}

            <div
              key="snippets-explorer-dragline"
              className="tm:-mt-px tm:h-0.5 tm:rounded-full tm:bg-blue"
              style={tree.getDragLineStyle()}
            />
          </div>
        )}
    </div>
  );
};

// --- Tree item components ---

interface ISnippetTreeItemProps {
  item: ItemInstance<SnippetItem>;
  focusedItemId: string | null;
  treeFocused: boolean;
  snippetDialog: ISnippetDialogService;
  suppressSelectionStyle: boolean;
  childCount?: number;
}

function SnippetTreeItem({ item, focusedItemId, treeFocused, snippetDialog, suppressSelectionStyle, childCount }: ISnippetTreeItemProps) {
  const contextMenuService = useDependency(IContextMenuService);
  const snippetContextService = useDependency(ISnippetContextService);
  const data = item.getItemData();

  if (item.isRenaming()) {
    return <SnippetTreeItemRenaming item={item} />;
  }

  if (data.type === SnippetType.PACKAGE) {
    return (
      <PackageRow
        item={item}
        pkg={data as ISnippetPackage}
        focusedItemId={focusedItemId}
        treeFocused={treeFocused}
        suppressSelectionStyle={suppressSelectionStyle}
        contextMenuService={contextMenuService}
        snippetContextService={snippetContextService}
        childCount={childCount}
      />
    );
  }

  return (
    <SnippetRow
      item={item}
      snippet={data as ISnippet}
      focusedItemId={focusedItemId}
      treeFocused={treeFocused}
      suppressSelectionStyle={suppressSelectionStyle}
      contextMenuService={contextMenuService}
      snippetContextService={snippetContextService}
      snippetDialog={snippetDialog}
    />
  );
}

// --- Package row ---

interface IPackageRowProps {
  item: ItemInstance<SnippetItem>;
  pkg: ISnippetPackage;
  focusedItemId: string | null;
  treeFocused: boolean;
  suppressSelectionStyle: boolean;
  contextMenuService: IContextMenuService;
  snippetContextService: ISnippetContextService;
  childCount?: number;
}

function PackageRow({ item, pkg, focusedItemId, treeFocused, suppressSelectionStyle, contextMenuService, snippetContextService, childCount }: IPackageRowProps) {
  const itemProps = item.getProps();
  const isSelected = item.isSelected();
  const isFocused = focusedItemId === item.getId();
  const isDragTarget = item.isDragTarget();

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    item.setFocused();
    item.select();
    snippetContextService.setPackageTarget(pkg);
    contextMenuService.triggerContextMenu(e.nativeEvent, PACKAGE_CONTEXT_MENU);
  };

  const isActiveSelected = !suppressSelectionStyle && treeFocused && isSelected;
  const shouldShowFocusStyle = !suppressSelectionStyle && isFocused && !isSelected;

  return (
    <div
      {...itemProps}
      onContextMenu={handleContextMenu}
      className={cn(`
        tm:flex tm:w-full tm:items-center tm:gap-2 tm:rounded-md tm:px-2 tm:py-1.5 tm:text-left tm:text-[12px]
        tm:outline-hidden tm:select-none
        tm:hover:bg-one-bg2
      `, {
        'tm:bg-one-bg3': shouldShowFocusStyle,
        'tm:ring-1 tm:ring-blue tm:ring-inset': isActiveSelected,
        'tm:bg-blue/20 tm:ring-1 tm:ring-blue': isDragTarget,
      })}
      style={{
        paddingLeft: `${item.getItemMeta().level * 16 + 8}px`,
        ...(isActiveSelected ? { backgroundColor: 'color-mix(in srgb, var(--tm-blue) 15%, transparent)' } : {}),
      }}
    >
      {item.isExpanded()
        ? <ChevronDown className="tm:size-3.5 tm:shrink-0 tm:text-grey-fg2" />
        : <ChevronRight className="tm:size-3.5 tm:shrink-0 tm:text-grey-fg2" />}
      <Package className="tm:size-3.5 tm:shrink-0 tm:text-yellow" />
      <span className="tm:flex-1 tm:truncate tm:font-medium tm:text-white">{pkg.label}</span>
      <span className="tm:text-[11px] tm:text-white">{childCount ?? 0}</span>
    </div>
  );
}

// --- Snippet row (card style) ---

interface ISnippetRowProps {
  item: ItemInstance<SnippetItem>;
  snippet: ISnippet;
  focusedItemId: string | null;
  treeFocused: boolean;
  suppressSelectionStyle: boolean;
  contextMenuService: IContextMenuService;
  snippetContextService: ISnippetContextService;
  snippetDialog: ISnippetDialogService;
}

function SnippetRow({ item, snippet, focusedItemId, treeFocused, suppressSelectionStyle, contextMenuService, snippetContextService, snippetDialog }: ISnippetRowProps) {
  const itemProps = item.getProps();
  const isSelected = item.isSelected();
  const isFocused = focusedItemId === item.getId();
  const isDragTarget = item.isDragTarget();

  const handleClick = (e: MouseEvent) => {
    itemProps.onClick?.(e as any);
    snippetDialog.openEdit(snippet.id);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    item.setFocused();
    item.select();
    snippetContextService.setTarget(snippet);
    contextMenuService.triggerContextMenu(e.nativeEvent, SNIPPET_CONTEXT_MENU);
  };

  const isActiveSelected = !suppressSelectionStyle && treeFocused && isSelected;
  const shouldShowFocusStyle = !suppressSelectionStyle && isFocused && !isSelected;

  return (
    <div
      {...itemProps}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        `
          tm:flex tm:items-center tm:gap-2.5 tm:rounded-lg tm:border tm:border-line tm:bg-black tm:p-2.5 tm:text-left
          tm:outline-hidden
          tm:hover:bg-one-bg2
        `,
        {
          'tm:border-nord-blue': isActiveSelected,
          'tm:bg-one-bg3': shouldShowFocusStyle,
          'tm:bg-blue/20 tm:ring-1 tm:ring-blue': isDragTarget,
        }
      )}
      style={{
        marginLeft: `${item.getItemMeta().level * 16}px`,
        marginRight: `${item.getItemMeta().level * 16}px`,
      }}
    >
      <span
        className={cn(`
          tm:flex tm:size-9 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-lg tm:bg-blue tm:text-[#fff]
        `)}
      >
        <Braces size={18} strokeWidth={1.6} />
      </span>
      <div className="tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:gap-0.5">
        <span className="tm:truncate tm:text-[13px] tm:font-semibold tm:text-white">{snippet.label}</span>
        {snippet.content && (
          <span className="tm:truncate tm:text-[11px] tm:text-grey-fg">
            {snippet.content.split('\n')[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Renaming ---

function SnippetTreeItemRenaming({ item }: { item: ItemInstance<SnippetItem> }) {
  return (
    <div
      className={cn(
        'tm:flex tm:w-full tm:items-center tm:gap-2 tm:rounded-md tm:px-2 tm:py-1.5'
      )}
      style={{ paddingLeft: `${item.getItemMeta().level * 16 + 8}px` }}
    >
      <ChevronRight className="tm:size-3.5 tm:shrink-0 tm:text-grey" />
      <Package className="tm:size-3.5 tm:shrink-0 tm:text-yellow" />
      <input
        {...item.getRenameInputProps()}
        className={cn(`
          tm:h-[18px] tm:min-w-0 tm:flex-1 tm:rounded-xs tm:border tm:border-blue tm:bg-one-bg2 tm:px-1 tm:text-[12px]
          tm:text-white tm:outline-hidden
        `)}
      />
    </div>
  );
}

// --- Inline input for package create ---

interface IInlinePackageInputProps {
  depth: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

const InlinePackageInput: FC<IInlinePackageInputProps> = ({ depth, onConfirm, onCancel }) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim();
      if (value) {
        onConfirm(value);
      } else {
        onCancel();
      }
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className={cn('tm:flex tm:w-full tm:items-center tm:gap-2 tm:rounded-md tm:px-2 tm:py-1.5')}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <ChevronRight className="tm:size-3.5 tm:shrink-0 tm:text-grey" />
      <Package className="tm:size-3.5 tm:shrink-0 tm:text-yellow" />
      <input
        ref={(el) => el?.focus()}
        className={cn(`
          tm:h-[18px] tm:min-w-0 tm:flex-1 tm:rounded-xs tm:border tm:border-blue tm:bg-one-bg2 tm:px-1 tm:text-[12px]
          tm:text-white tm:outline-hidden
        `)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
      />
    </div>
  );
};
