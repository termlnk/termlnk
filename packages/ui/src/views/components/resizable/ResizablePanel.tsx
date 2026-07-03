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
import type { Layout } from 'react-resizable-panels';
import type { SidePanelType } from '../../../services/resizable/resizable.service';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { useEffect, useState } from 'react';
import { Group, Panel, Separator, useGroupRef } from 'react-resizable-panels';
import { DEFAULT_PAGE_ID, IContentRouterService } from '../../../services/content-router/content-router.service';
import { SIDE_TAB_BAR_WIDTH_REM } from '../../../services/layout/layout.constants';
import { BuiltInUIPart } from '../../../services/parts/parts.service';
import { ResizableService } from '../../../services/resizable/resizable.service';
import { SideTabBarService } from '../../../services/side-tab-bar/side-tab-bar.service';
import { ComponentContainer, useComponentsOfPart } from '../ComponentContainer';
import { SideTabBar } from '../side-tab-bar/SideTabBar';
import { TabPanel } from '../side-tab-bar/TabPanel';

export const WORKBENCH_RESIZABLE_KEY = 'workbench-resizable';

export function ResizablePanel() {
  const resizableService = useDependency(ResizableService);
  const contentRouterService = useDependency(IContentRouterService);
  const sideTabBarService = useDependency(SideTabBarService);

  const activePage = useObservable(contentRouterService.activePage$, DEFAULT_PAGE_ID);
  const layout = useObservable(resizableService.layout$, resizableService.layout);
  const isSidebarVisible = useObservable(sideTabBarService.visible$, sideTabBarService.visible);

  const ref = useGroupRef();
  const manual = useObservable(resizableService.manual$) as Record<SidePanelType, boolean>;
  const contentComponents = useComponentsOfPart(BuiltInUIPart.CONTENT);
  const rightSidebarComponents = useComponentsOfPart(BuiltInUIPart.RIGHT_SIDEBAR);

  // Track pages that have been visited so they stay mounted (lazy mount, never unmount)
  const [mountedPageIds, setMountedPageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activePage !== DEFAULT_PAGE_ID) {
      setMountedPageIds((prev) => {
        if (prev.has(activePage)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(activePage);
        return next;
      });
    }
  }, [activePage]);

  useEffect(() => {
    let dynamicLayout: Nullable<Layout>;
    if (typeof manual?.left !== 'undefined') {
      dynamicLayout = manual.left ? resizableService.getCollapseLayout('left') : resizableService.getExpandLayout('left');
    } else if (typeof manual?.right !== 'undefined') {
      dynamicLayout = manual.right ? resizableService.getCollapseLayout('right') : resizableService.getExpandLayout('right');
    }
    if (dynamicLayout) {
      ref.current?.setLayout(dynamicLayout);
    }
  }, [manual]);

  const isTerminal = activePage === DEFAULT_PAGE_ID;
  const isLeftCollapsed = layout.left === 0;
  const isRightCollapsed = layout.right === 0;

  return (
    <div className="tm:flex tm:h-full">
      {isSidebarVisible && (
        <SideTabBar
          className={`
            tm:flex tm:h-full tm:flex-col tm:overflow-hidden tm:border-0 tm:border-r tm:border-solid tm:border-line
            tm:bg-statusline-bg tm:text-light-grey tm:select-none
          `}
          style={{ width: `${SIDE_TAB_BAR_WIDTH_REM}rem` }}
        />
      )}

      <Group
        id={WORKBENCH_RESIZABLE_KEY}
        orientation="horizontal"
        defaultLayout={resizableService.layout}
        onLayoutChange={(layout) => resizableService.setLayout(layout)}
        groupRef={ref}
        className="tm:h-full tm:min-w-0 tm:flex-1"
      >
        <Panel
          id="left"
          className="tm:h-full tm:overflow-auto tm:border-0 tm:border-line tm:text-white"
          collapsible
          minSize="8%"
        >
          {isSidebarVisible && <TabPanel />}
        </Panel>

        <Separator
          disabled={!isSidebarVisible}
          className={cn(
            `
              tm:relative tm:z-10 tm:h-full tm:w-px tm:origin-center tm:border-0 tm:outline-hidden tm:transition
              tm:duration-150 tm:ease-linear
              tm:data-[separator='active']:scale-x-[2] tm:data-[separator='active']:bg-blue/70
              tm:data-[separator='hover']:scale-x-[2] tm:data-[separator='hover']:bg-blue/70
            `,
            {
              'tm:bg-transparent': isLeftCollapsed,
              'tm:bg-line': !isLeftCollapsed,
            }
          )}
        />

        <Panel
          id="content"
          className="tm:relative tm:h-full"
          minSize="10%"
        >
          {/* Terminal content - always mounted */}
          <section
            className={cn(
              'tm:absolute tm:inset-0 tm:grid tm:grid-rows-[auto_1fr] tm:overflow-hidden',
              { 'tm:pointer-events-none tm:opacity-0': !isTerminal }
            )}
            onContextMenu={(e) => e.preventDefault()}
          >
            <ComponentContainer key="content" components={contentComponents} />
          </section>

          {/* Routed pages - mounted on first visit, never unmounted */}
          {Array.from(mountedPageIds, (pageId) => {
            const page = contentRouterService.getPage(pageId);
            if (!page) {
              return null;
            }
            const Component = page.component;
            return (
              <div
                key={pageId}
                className={cn(
                  'tm:absolute tm:inset-0 tm:overflow-hidden',
                  { 'tm:pointer-events-none tm:opacity-0': activePage !== pageId }
                )}
              >
                <Component />
              </div>
            );
          })}
        </Panel>

        <Separator
          className={cn(
            `
              tm:relative tm:z-10 tm:h-full tm:w-px tm:origin-center tm:border-0 tm:outline-hidden tm:transition
              tm:duration-150 tm:ease-linear
              tm:data-[separator='active']:scale-x-[2] tm:data-[separator='active']:bg-blue/70
              tm:data-[separator='hover']:scale-x-[2] tm:data-[separator='hover']:bg-blue/70
            `,
            {
              'tm:bg-transparent': isRightCollapsed,
              'tm:bg-line': !isRightCollapsed,
            }
          )}
        />

        <Panel
          id="right"
          className="tm:h-full tm:bg-black tm:text-white"
          collapsible
          minSize="8%"
        >
          <ComponentContainer key="right-sidebar" components={rightSidebarComponents} />
        </Panel>
      </Group>
    </div>
  );
}
