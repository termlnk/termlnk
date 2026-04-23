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

import type { Nullable } from '@termlnk/core';
import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import type { ITabDisplayItem } from '../../models/workspace.model';
import { isDefined } from '@termlnk/core';
import { Button, cn, useDependency } from '@termlnk/design';
import { TooltipWrapper } from '@termlnk/ui';
import { Ellipsis, Plus } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OpenLocalTerminalCommand } from '../../commands/open-local-terminal.command';
import { ToggleTabListCommand } from '../../commands/toggle-tab-list.command';
import { ITabListDropdownService } from '../../services/tab-list-dropdown/tab-list-dropdown.service';
import { TerminalTabItem } from './TerminalTabItem';
import { WorkspaceTabItem } from './WorkspaceTabItem';

interface IDragState {
  id: string;
  width: number;
  height: number;
  offsetXViewport: number;
}

type RenderedTabEntry = { type: 'tab'; item: ITabDisplayItem } | { type: 'placeholder' };

export interface ITerminalTabsProps {
  items: ITabDisplayItem[];
  activeTabItemId: Nullable<string>;
  externalDragDropIndex: Nullable<number>;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddSession?: () => void;
  onReorderTab?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onMergeTab?: (sourceId: string, targetId: string) => void;
}

export function TerminalTabs(props: ITerminalTabsProps) {
  const {
    items,
    activeTabItemId,
    externalDragDropIndex,
    onSelectTab,
    onCloseTab,
    onAddSession,
    onReorderTab,
    onMergeTab,
  } = props;
  const dropdownService = useDependency(ITabListDropdownService);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [dragState, setDragState] = useState<IDragState | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const pointerDownRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    pointerId: number;
    target: HTMLDivElement;
  } | null>(null);
  const dragStateRef = useRef<IDragState | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const mergeTargetIdRef = useRef<string | null>(null);
  const dragXRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const itemsRef = useRef(items);

  const handleToggleTabList = useCallback(() => {
    dropdownService.toggle();
  }, [dropdownService]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!isOverflowing) {
        return;
      }

      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
        return;
      }

      const scrollEl = scrollRef.current;
      if (!scrollEl) {
        return;
      }

      event.preventDefault();
      scrollEl.scrollLeft += event.deltaY;
    },
    [isOverflowing]
  );

  const updateDragX = useCallback((nextX: number) => {
    dragXRef.current = nextX;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setDragX(dragXRef.current);
    });
  }, []);

  const getDropIndex = useCallback((contentX: number, draggedId: string) => {
    const ids = itemsRef.current.map((item) => item.id).filter((id) => id !== draggedId);
    if (ids.length === 0) return null;

    const positions = ids
      .map((id) => {
        const node = itemRefs.current.get(id);
        if (!node) return null;
        return {
          left: node.offsetLeft,
          width: node.offsetWidth,
        };
      })
      .filter((value): value is { left: number; width: number } => Boolean(value));

    let index = ids.length;
    for (let i = 0; i < positions.length; i++) {
      if (contentX <= positions[i].left + positions[i].width / 2) {
        index = i;
        break;
      }
    }

    return index;
  }, []);

  const getMergeTarget = useCallback(
    (clientX: number, clientY: number, draggedId: string): string | null => {
      if (!onMergeTab) return null;

      for (const [id, node] of itemRefs.current) {
        if (id === draggedId) continue;
        const rect = node.getBoundingClientRect();
        // Check if pointer is within the center 50% of the tab
        const centerLeft = rect.left + rect.width * 0.25;
        const centerRight = rect.right - rect.width * 0.25;
        if (
          clientX >= centerLeft &&
          clientX <= centerRight &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return id;
        }
      }
      return null;
    },
    [onMergeTab]
  );

  const handlePointerDown = useCallback(
    (id: string) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!onReorderTab) return;
      if (event.button !== 0) return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      pointerDownRef.current = {
        id,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        target,
      };
      suppressClickRef.current = false;
    },
    [onReorderTab]
  );

  // Detect tabs overflow by measuring tabs-only width against scroll container.
  // Using tabsRef (not scrollRef) for scrollWidth ensures the measurement is
  // independent of inline "+" button presence, preventing oscillation.
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const tabsEl = tabsRef.current;
    if (!scrollEl || !tabsEl) return;

    const check = () => {
      setIsOverflowing(tabsEl.scrollWidth > scrollEl.clientWidth + 1);
    };

    check();

    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(scrollEl);
    resizeObserver.observe(tabsEl);

    const mutationObserver = new MutationObserver(check);
    mutationObserver.observe(tabsEl, { childList: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // Sync state values to refs for use in pointer event handlers
  useEffect(() => {
    itemsRef.current = items;
    dragStateRef.current = dragState;
    dragOverIndexRef.current = dragOverIndex;
    mergeTargetIdRef.current = mergeTargetId;
  }, [items, dragState, dragOverIndex, mergeTargetId]);

  useEffect(() => {
    if (!onReorderTab) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const down = pointerDownRef.current;
      if (!down || down.pointerId !== event.pointerId) return;

      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      const movedX = Math.abs(event.clientX - down.startX);
      const movedY = Math.abs(event.clientY - down.startY);

      if (!dragStateRef.current) {
        if (movedX < 4 && movedY < 4) return;
        const node = itemRefs.current.get(down.id);
        if (!node) return;
        const nodeRect = node.getBoundingClientRect();
        const dragWidth = node.offsetWidth;
        const dragHeight = node.offsetHeight;
        const offsetXViewport = event.clientX - nodeRect.left;
        const initialXViewport = nodeRect.left;
        setDragState({ id: down.id, width: dragWidth, height: dragHeight, offsetXViewport });
        dragXRef.current = initialXViewport;
        setDragX(initialXViewport);
        suppressClickRef.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        const currentIndex = itemsRef.current.findIndex((item) => item.id === down.id);
        setDragOverIndex(currentIndex >= 0 ? currentIndex : 0);
      }

      if (!dragStateRef.current) return;

      const rect = scrollEl.getBoundingClientRect();
      const scrollLeft = scrollEl.scrollLeft;
      const contentX = event.clientX - rect.left + scrollLeft;
      const visualLeft = event.clientX - dragStateRef.current.offsetXViewport;
      updateDragX(visualLeft);
      const dragCenterX = dragXRef.current - rect.left + scrollLeft + dragStateRef.current.width / 2;
      const dropX = Math.max(dragCenterX, contentX);
      const inBounds =
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right;

      // Check for merge target (center 50% of a tab)
      const target = getMergeTarget(event.clientX, event.clientY, dragStateRef.current.id);
      if (target) {
        if (mergeTargetIdRef.current !== target) {
          setMergeTargetId(target);
        }
        setDragOverIndex(null);
      } else {
        if (mergeTargetIdRef.current !== null) {
          setMergeTargetId(null);
        }
        const nextIndex = getDropIndex(dropX, dragStateRef.current.id);
        if (nextIndex !== null && nextIndex !== dragOverIndexRef.current) {
          if (inBounds || dragOverIndexRef.current !== null) {
            setDragOverIndex(nextIndex);
          }
        }
      }

      const edge = 24;
      if (event.clientX - rect.left < edge) {
        scrollEl.scrollLeft -= 10;
      } else if (rect.right - event.clientX < edge) {
        scrollEl.scrollLeft += 10;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const down = pointerDownRef.current;
      if (!down || down.pointerId !== event.pointerId) return;
      down.target.releasePointerCapture(down.pointerId);
      pointerDownRef.current = null;

      if (dragStateRef.current) {
        const draggedId = dragStateRef.current.id;

        // Check merge first
        if (mergeTargetIdRef.current) {
          onMergeTab?.(draggedId, mergeTargetIdRef.current);
        } else {
          const ids = itemsRef.current.map((item) => item.id).filter((id) => id !== draggedId);
          if (ids.length > 0) {
            const scrollEl = scrollRef.current;
            let dropX = dragXRef.current + dragStateRef.current.width / 2;
            if (scrollEl) {
              const rect = scrollEl.getBoundingClientRect();
              const scrollLeft = scrollEl.scrollLeft;
              const contentX = event.clientX - rect.left + scrollLeft;
              dropX = Math.max(dropX - rect.left + scrollLeft, contentX);
            }
            let index = getDropIndex(dropX, draggedId);
            if (index === null) {
              index = dragOverIndexRef.current ?? ids.length;
            }
            let targetId = ids.at(-1);
            let position: 'before' | 'after' = 'after';
            if (index <= 0) {
              targetId = ids[0];
              position = 'before';
            } else if (index < ids.length) {
              targetId = ids[index];
              position = 'before';
            }
            onReorderTab?.(draggedId, targetId!, position);
          }
        }
      }

      setDragState(null);
      setDragOverIndex(null);
      setMergeTargetId(null);
      setDragX(0);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [getDropIndex, getMergeTarget, onMergeTab, onReorderTab, updateDragX]);

  const renderedItems = useMemo(() => {
    // External drag from workspace pane (no internal drag active)
    if (!dragState && isDefined(externalDragDropIndex)) {
      const result: RenderedTabEntry[] = [];
      const index = Math.min(Math.max(externalDragDropIndex, 0), items.length);
      items.forEach((item, i) => {
        if (i === index) {
          result.push({ type: 'placeholder' });
        }
        result.push({ type: 'tab', item });
      });
      if (index === items.length) {
        result.push({ type: 'placeholder' });
      }
      return result;
    }

    if (!dragState) {
      return items.map((item) => ({ type: 'tab' as const, item }));
    }
    const filtered = items.filter((item) => item.id !== dragState.id);
    const result: RenderedTabEntry[] = [];
    const index =
      dragOverIndex === null
        ? filtered.length
        : Math.min(Math.max(dragOverIndex, 0), filtered.length);
    filtered.forEach((item, i) => {
      if (i === index) {
        result.push({ type: 'placeholder' });
      }
      result.push({ type: 'tab', item });
    });
    if (index === filtered.length) {
      result.push({ type: 'placeholder' });
    }
    return result;
  }, [dragOverIndex, dragState, externalDragDropIndex, items]);

  useLayoutEffect(() => {
    if (!dragState) {
      return;
    }

    const nodes = itemRefs.current;
    nodes.forEach((node) => {
      const prev = (node as HTMLDivElement & { __prevLeft?: number }).__prevLeft;
      const nextLeft = node.offsetLeft;
      if (prev !== undefined && prev !== nextLeft) {
        const delta = prev - nextLeft;
        node.style.transition = 'transform 0s';
        node.style.transform = `translateX(${delta}px)`;
        requestAnimationFrame(() => {
          node.style.transition = 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)';
          node.style.transform = '';
        });
      }
      (node as HTMLDivElement & { __prevLeft?: number }).__prevLeft = nextLeft;
    });
  }, [dragState, dragOverIndex, renderedItems]);

  const handleSelectTabSafe = useCallback(
    (id: string) => {
      if (suppressClickRef.current) return;
      onSelectTab(id);
    },
    [onSelectTab]
  );

  const draggedItem = dragState ? items.find((i) => i.id === dragState.id) : null;

  const renderTabItem = (item: ITabDisplayItem, isMergeTarget: boolean) => {
    if (item.tabType === 'workspace') {
      return (
        <WorkspaceTabItem
          key={item.id}
          className="electron-no-drag"
          id={item.id}
          label={item.label}
          sessionCount={item.sessionCount ?? 0}
          isActive={item.id === activeTabItemId}
          isDragging={dragState?.id === item.id}
          isMergeTarget={isMergeTarget}
          tabRef={(node) => {
            if (node) itemRefs.current.set(item.id, node);
            else itemRefs.current.delete(item.id);
          }}
          onPointerDown={handlePointerDown(item.id)}
          onClick={() => handleSelectTabSafe(item.id)}
          onClose={() => onCloseTab(item.id)}
        />
      );
    }

    return (
      <TerminalTabItem
        key={item.id}
        className="electron-no-drag"
        id={item.id}
        type={item.sessionType ?? 'ssh'}
        label={item.label}
        status={item.sessionStatus ?? 'idle'}
        isActive={item.id === activeTabItemId}
        isDragging={dragState?.id === item.id}
        isMergeTarget={isMergeTarget}
        tabRef={(node) => {
          if (node) itemRefs.current.set(item.id, node);
          else itemRefs.current.delete(item.id);
        }}
        onPointerDown={handlePointerDown(item.id)}
        onClick={() => handleSelectTabSafe(item.id)}
        onClose={() => onCloseTab(item.id)}
      />
    );
  };

  return (
    <div
      className={`
        electron-dragable tm:grid tm:size-full tm:min-w-0 tm:grid-cols-[minmax(0,1fr)_auto] tm:items-stretch
        tm:overflow-hidden
      `}
    >
      {/* Scrollable tabs area */}
      <div
        ref={scrollRef}
        data-terminal-tabs-scroll
        className={`
          scrollbar-none tm:relative tm:flex tm:min-w-0 tm:flex-1 tm:items-stretch tm:overflow-x-auto
          tm:overflow-y-hidden
        `}
        onWheel={handleWheel}
      >
        {/* Tabs wrapper for independent width measurement */}
        <div ref={tabsRef} className="tm:flex tm:shrink-0 tm:items-stretch">
          {renderedItems.map((entry, index) => {
            if (entry.type === 'placeholder') {
              return (
                <div
                  key={`placeholder-${index}`}
                  className="tm:flex tm:h-full tm:items-center tm:px-1"
                  style={{ width: dragState?.width ?? 120 }}
                >
                  <div
                    className={cn(
                      'tm:h-[calc(100%-6px)] tm:w-full tm:rounded-lg tm:border tm:border-line tm:bg-one-bg2/50',
                      'tm:opacity-80 tm:transition-all tm:duration-180',
                      'tm:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--tm-blue)_25%,transparent)]'
                    )}
                  />
                </div>
              );
            }

            return renderTabItem(entry.item, mergeTargetId === entry.item.id);
          })}
        </div>

        {dragState && (
          <div
            className="tm:pointer-events-none tm:fixed tm:z-10"
            style={{
              width: dragState.width,
              height: dragState.height,
              left: dragX,
              top:
                (scrollRef.current?.getBoundingClientRect().top ?? 0) +
                ((scrollRef.current?.clientHeight ?? dragState.height) - dragState.height) / 2,
            }}
          >
            {draggedItem?.tabType === 'workspace'
              ? (
                <WorkspaceTabItem
                  className="electron-no-drag tm:pointer-events-none"
                  id={draggedItem.id}
                  label={draggedItem.label}
                  sessionCount={draggedItem.sessionCount ?? 0}
                  isActive={draggedItem.id === activeTabItemId}
                  isFloating
                  onPointerDown={undefined}
                  onClick={() => {}}
                  onClose={() => {}}
                />
              )
              : (
                draggedItem && (
                  <TerminalTabItem
                    className="electron-no-drag tm:pointer-events-none"
                    id={draggedItem.id}
                    type={draggedItem.sessionType ?? 'ssh'}
                    label={draggedItem.label}
                    status={draggedItem.sessionStatus ?? 'idle'}
                    isActive={draggedItem.id === activeTabItemId}
                    isFloating
                  />
                )
              )}
          </div>
        )}

        {/* Inline "+" button when NOT overflowing */}
        {onAddSession && !isOverflowing && (
          <TooltipWrapper
            side="bottom"
            labelKey="terminal-ui.tab-bar.new-session"
            commandId={OpenLocalTerminalCommand.id}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn('electron-no-drag tm:mx-1 tm:my-auto')}
              onClick={onAddSession}
            >
              <Plus size={14} strokeWidth={1.5} />
            </Button>
          </TooltipWrapper>
        )}
      </div>

      {/* Fixed right buttons when overflowing */}
      {isOverflowing && (
        <div
          className={`
            electron-no-drag tm:flex tm:h-full tm:min-w-17 tm:items-center tm:gap-0.5 tm:bg-darker-black tm:px-1
          `}
        >
          <TooltipWrapper
            side="bottom"
            labelKey="terminal-ui.tab-bar.tab-list"
            commandId={ToggleTabListCommand.id}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleToggleTabList}
            >
              <Ellipsis size={14} strokeWidth={1.5} />
            </Button>
          </TooltipWrapper>

          {onAddSession && (
            <TooltipWrapper
              side="bottom"
              labelKey="terminal-ui.tab-bar.new-session"
              commandId={OpenLocalTerminalCommand.id}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onAddSession}
              >
                <Plus size={14} strokeWidth={1.5} />
              </Button>
            </TooltipWrapper>
          )}
        </div>
      )}
    </div>
  );
}
