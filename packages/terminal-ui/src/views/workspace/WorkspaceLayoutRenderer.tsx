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

import type { Layout } from 'react-resizable-panels';
import type { IWorkspaceLayoutNode } from '../../models/workspace.model';
import { cn, useDependency } from '@termlnk/design';
import { useCallback, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { IWorkspaceService } from '../../services/workspace/workspace.service';
import { WorkspacePane } from './WorkspacePane';

interface IWorkspaceLayoutRendererProps {
  workspaceId: string;
  node: IWorkspaceLayoutNode;
  activeSessionId: string | null;
  magnifiedSessionId: string | null;
  path: number[];
}

export function WorkspaceLayoutRenderer(props: IWorkspaceLayoutRendererProps) {
  const { workspaceId, node, activeSessionId, magnifiedSessionId, path } = props;
  const workspaceService = useDependency(IWorkspaceService);

  const handleLayoutChange = useCallback((layout: Layout) => {
    if (node.type !== 'branch') return;
    const sizes = node.children.map((_, i) => layout[`panel-${i}`] ?? (100 / node.children.length));
    workspaceService.updatePanelSizes(workspaceId, path, sizes);
  }, [workspaceService, workspaceId, path, node]);

  // Build defaultLayout map for the Group: { "panel-0": 50, "panel-1": 50 }
  const defaultLayout = useMemo<Layout | undefined>(() => {
    if (node.type !== 'branch') return undefined;
    const layout: Layout = {};
    node.children.forEach((_, i) => {
      layout[`panel-${i}`] = node.sizes[i];
    });
    return layout;
  }, [node]);

  if (node.type === 'leaf') {
    return (
      <WorkspacePane
        workspaceId={workspaceId}
        sessionId={node.sessionId}
        isActive={node.sessionId === activeSessionId}
        isMagnified={node.sessionId === magnifiedSessionId}
      />
    );
  }

  const orientation = node.direction === 'horizontal' ? 'horizontal' : 'vertical';

  return (
    <Group
      id={`ws-${workspaceId}-${path.join('-') || 'root'}`}
      orientation={orientation}
      defaultLayout={defaultLayout}
      onLayoutChange={handleLayoutChange}
      className="tm:flex tm:size-full"
    >
      {node.children.map((child, i) => {
        const panelId = `panel-${i}`;
        return (
          <WorkspacePanelEntry
            key={panelId}
            index={i}
            panelId={panelId}
            orientation={orientation}
            workspaceId={workspaceId}
            childNode={child}
            activeSessionId={activeSessionId}
            magnifiedSessionId={magnifiedSessionId}
            path={[...path, i]}
          />
        );
      })}
    </Group>
  );
}

export interface IWorkspacePanelEntryProps {
  index: number;
  panelId: string;
  orientation: 'horizontal' | 'vertical';
  workspaceId: string;
  childNode: IWorkspaceLayoutNode;
  activeSessionId: string | null;
  magnifiedSessionId: string | null;
  path: number[];
}

function WorkspacePanelEntry(props: IWorkspacePanelEntryProps) {
  const { index, panelId, orientation, workspaceId, childNode, activeSessionId, magnifiedSessionId, path } = props;
  return (
    <>
      {index > 0 && (
        <Separator
          className={cn({
            [`
              tm:relative tm:z-10 tm:h-full tm:w-0 tm:shrink-0 tm:border-0 tm:bg-transparent tm:outline-hidden
              tm:duration-150 tm:ease-linear
              tm:before:pointer-events-none tm:before:absolute tm:before:inset-y-0 tm:before:left-1/2 tm:before:w-px
              tm:before:-translate-x-1/2 tm:before:bg-transparent tm:before:opacity-0
              tm:before:transition-[opacity,background-color] tm:before:duration-150 tm:before:ease-linear
              tm:before:content-['']
              tm:after:absolute tm:after:inset-y-0 tm:after:left-1/2 tm:after:w-2.5 tm:after:-translate-x-1/2
              tm:after:bg-transparent tm:after:content-['']
              tm:data-[separator='active']:before:bg-nord-blue/80 tm:data-[separator='active']:before:opacity-100
              tm:data-[separator='hover']:before:bg-blue/75 tm:data-[separator='hover']:before:opacity-100
            `]: orientation === 'horizontal',
            [`
              tm:relative tm:z-10 tm:h-0 tm:w-full tm:shrink-0 tm:border-0 tm:bg-transparent tm:outline-hidden
              tm:duration-150 tm:ease-linear
              tm:before:pointer-events-none tm:before:absolute tm:before:inset-x-0 tm:before:top-1/2 tm:before:h-px
              tm:before:-translate-y-1/2 tm:before:bg-transparent tm:before:opacity-0
              tm:before:transition-[opacity,background-color] tm:before:duration-150 tm:before:ease-linear
              tm:before:content-['']
              tm:after:absolute tm:after:inset-x-0 tm:after:top-1/2 tm:after:h-2.5 tm:after:-translate-y-1/2
              tm:after:bg-transparent tm:after:content-['']
              tm:data-[separator='active']:before:bg-nord-blue/80 tm:data-[separator='active']:before:opacity-100
              tm:data-[separator='hover']:before:bg-blue/75 tm:data-[separator='hover']:before:opacity-100
            `]: orientation !== 'horizontal',
          })}
        />
      )}
      <Panel
        id={panelId}
        minSize={10}
        className="tm:relative tm:h-full"
      >
        <WorkspaceLayoutRenderer
          workspaceId={workspaceId}
          node={childNode}
          activeSessionId={activeSessionId}
          magnifiedSessionId={magnifiedSessionId}
          path={path}
        />
      </Panel>
    </>
  );
}
