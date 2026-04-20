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

import type { DropSide, IWorkspace, IWorkspaceLayoutNode } from '../../models/workspace.model';
import type { IWorkspaceDragContext, IWorkspaceDragState, IWorkspaceDropTarget } from './workspace-drag-context';
import { Platform, platform } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IWorkspaceService } from '../../services/workspace/workspace.service';
import { useWindowTransparency } from '../hooks';
import { WorkspaceDragContext } from './workspace-drag-context';
import { WorkspaceLayoutRenderer } from './WorkspaceLayoutRenderer';

interface IWorkspaceContainerProps {
  workspaceId: string;
}

function getFirstSessionId(node: IWorkspaceLayoutNode): string | null {
  if (node.type === 'leaf') return node.sessionId;
  for (const child of node.children) {
    const id = getFirstSessionId(child);
    if (id) return id;
  }
  return null;
}

export function WorkspaceContainer({ workspaceId }: IWorkspaceContainerProps) {
  const workspaceService = useDependency(IWorkspaceService);
  const workspaces = useObservable(workspaceService.workspaces$, []);
  const magnifyState = useObservable(workspaceService.magnifyState$, null);

  const workspace = useMemo<IWorkspace | undefined>(
    () => workspaces.find((w) => w.id === workspaceId),
    [workspaces, workspaceId]
  );

  const transparency = useWindowTransparency();
  const isTransparent = platform !== Platform.Windows && transparency.enabled && transparency.opacity < 1;

  const isMagnified = magnifyState?.workspaceId === workspaceId;
  const magnifiedSessionId = isMagnified ? magnifyState?.sessionId ?? null : null;
  const effectiveActiveSessionId = workspace ? (workspace.activeSessionId ?? getFirstSessionId(workspace.layout)) : null;
  const [backdropVisible, setBackdropVisible] = useState(false);

  // Esc to exit magnify
  const handleClearMagnify = useCallback(() => {
    workspaceService.clearMagnify();
  }, [workspaceService]);

  useEffect(() => {
    if (!isMagnified) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClearMagnify();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMagnified, handleClearMagnify]);

  useEffect(() => {
    if (isMagnified) {
      setBackdropVisible(true);
      return;
    }

    if (!backdropVisible) return;
    const timer = window.setTimeout(() => {
      setBackdropVisible(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isMagnified, backdropVisible]);

  // Workspace-internal drag state
  const [dragState, setDragState] = useState<IWorkspaceDragState | null>(null);
  const [dragTarget, setDragTarget] = useState<IWorkspaceDropTarget | null>(null);

  const handleDrop = useCallback((targetSessionId: string, side: DropSide) => {
    if (!dragState) return;
    workspaceService.moveSessionInWorkspace(workspaceId, dragState.draggedSessionId, targetSessionId, side);
    setDragState(null);
    setDragTarget(null);
  }, [dragState, workspaceService, workspaceId]);

  const dragContext = useMemo<IWorkspaceDragContext>(() => ({
    dragState,
    setDragState,
    dragTarget,
    setDragTarget,
    onDrop: handleDrop,
  }), [dragState, dragTarget, handleDrop]);

  if (!workspace) return null;
  const shouldRenderBackdrop = isMagnified || backdropVisible;

  return (
    <WorkspaceDragContext.Provider value={dragContext}>
      <div
        className={cn(
          'tm:relative tm:size-full tm:overflow-hidden tm:p-0',
          {
            'tm:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tm-black)_94%,transparent),color-mix(in_srgb,var(--tm-darker-black)_98%,transparent))]': !isTransparent,
          }
        )}
        style={{ transform: 'translateZ(0)' }}
      >
        <div
          className={`
            tm:pointer-events-none tm:absolute tm:inset-0
            tm:bg-[linear-gradient(to_right,color-mix(in_srgb,var(--tm-line)_20%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--tm-line)_20%,transparent)_1px,transparent_1px)]
            tm:bg-size-[24px_24px] tm:opacity-20
          `}
        />

        <WorkspaceLayoutRenderer
          workspaceId={workspaceId}
          node={workspace.layout}
          activeSessionId={effectiveActiveSessionId}
          magnifiedSessionId={magnifiedSessionId}
          path={[]}
        />

        {shouldRenderBackdrop && (
          <div
            className={cn(
              `
                tm:absolute tm:inset-0 tm:z-40 tm:bg-black/65 tm:backdrop-blur-[1.5px] tm:transition-opacity
                tm:duration-200 tm:ease-out
              `,
              {
                'tm:opacity-100': isMagnified,
                'tm:pointer-events-none tm:opacity-0': !isMagnified,
              }
            )}
            onClick={isMagnified ? handleClearMagnify : undefined}
          />
        )}
      </div>
    </WorkspaceDragContext.Provider>
  );
}
