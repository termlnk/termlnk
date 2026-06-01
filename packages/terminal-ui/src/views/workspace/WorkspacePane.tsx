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

import type { MouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import type { DropSide } from '../../models/workspace.model';
import type { TerminalSessionStatus } from '../../services/terminal/terminal-ui.service';
import { ILogService, Platform, platform } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { ISSHService } from '@termlnk/rpc-client';
import { IPTYService } from '@termlnk/terminal';
import { TooltipWrapper } from '@termlnk/ui';
import { Columns2, Loader2, Maximize2, Minimize2, Rows2, Terminal, X } from 'lucide-react';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseActiveTabCommand } from '../../commands/close-active-tab.command';
import { MaximizeSessionCommand } from '../../commands/maximize-session.command';
import { ITerminalUIService } from '../../services/terminal/terminal-ui.service';
import { splitTerminalSession } from '../../services/workspace/split-session';
import { IWorkspaceService } from '../../services/workspace/workspace.service';
import { useWindowTransparency } from '../hooks';
import { SessionPortalContext } from './session-portal-context';
import { WorkspaceDragContext } from './workspace-drag-context';

interface IWorkspacePaneProps {
  workspaceId: string;
  sessionId: string;
  isActive: boolean;
  isMagnified: boolean;
}

interface ITabBarDropTarget {
  dropIndex: number;
  targetTabId?: string;
  position?: 'before' | 'after';
}

const PANE_SESSION_ATTR = 'data-workspace-pane-session-id';
const MAGNIFY_EXIT_ANIMATION_MS = 180;

export function WorkspacePane({ workspaceId, sessionId, isActive, isMagnified }: IWorkspacePaneProps) {
  const terminalUIService = useDependency(ITerminalUIService);
  const workspaceService = useDependency(IWorkspaceService);
  const ptyService = useDependency(IPTYService);
  const sshService = useDependency(ISSHService);
  const logService = useDependency(ILogService);
  const portal = useContext(SessionPortalContext);
  const { dragState, setDragState, dragTarget, setDragTarget, onDrop } = useContext(WorkspaceDragContext);
  const sessions = useObservable(terminalUIService.sessions$, []);
  const transparency = useWindowTransparency();
  const isTransparent = platform !== Platform.Windows && transparency.enabled && transparency.opacity < 1;

  const session = sessions.find((s) => s.id === sessionId);
  const paneRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousMagnifyRef = useRef(isMagnified);
  const [isExitingMagnify, setIsExitingMagnify] = useState(false);

  // DOM reparenting: move the session element from TerminalContainer into this pane's content area
  useLayoutEffect(() => {
    const contentEl = contentRef.current;
    const sessionHostElement = portal.getHostElement(sessionId);
    if (!contentEl || !sessionHostElement) {
      return;
    }
    if (sessionHostElement.parentElement !== contentEl) {
      contentEl.appendChild(sessionHostElement);
    }

    return () => {
      portal.restoreHost(sessionId);
    };
  }, [sessionId, portal]);

  // React synthetic events don't follow DOM reparenting, so we activate via native capture listener.
  useEffect(() => {
    const el = paneRef.current;
    if (!el) {
      return;
    }

    const handler = () => {
      workspaceService.setActiveSessionInWorkspace(workspaceId, sessionId);
    };
    el.addEventListener('pointerdown', handler, true);
    return () => el.removeEventListener('pointerdown', handler, true);
  }, [workspaceService, workspaceId, sessionId]);

  useLayoutEffect(() => {
    const wasMagnified = previousMagnifyRef.current;
    previousMagnifyRef.current = isMagnified;

    if (isMagnified) {
      setIsExitingMagnify(false);
      return;
    }
    if (!wasMagnified) {
      return;
    }

    setIsExitingMagnify(true);
    const timer = window.setTimeout(() => {
      setIsExitingMagnify(false);
    }, MAGNIFY_EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isMagnified]);

  const handleMagnify = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    workspaceService.toggleMagnify(workspaceId, sessionId);
  }, [workspaceService, workspaceId, sessionId]);

  const handleClose = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    portal.restoreHost(sessionId);
    workspaceService.removeSessionFromWorkspace(workspaceId, sessionId);
  }, [workspaceService, workspaceId, sessionId, portal]);

  const handleSplit = useCallback((direction: 'horizontal' | 'vertical') => {
    splitTerminalSession({ ptyService, sshService, terminalUIService, workspaceService }, sessionId, direction)
      .catch((err) => logService.error('[WorkspacePane]', 'Failed to split session:', err));
  }, [ptyService, sshService, terminalUIService, workspaceService, sessionId, logService]);

  // --- Header drag for repositioning ---
  const pointerDownRef = useRef<{ startX: number; startY: number; pointerId: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragTargetRef = useRef(dragTarget);
  const tabBarTargetRef = useRef<ITabBarDropTarget | null>(null);

  useEffect(() => {
    dragTargetRef.current = dragTarget;
  }, [dragTarget]);

  const handleHeaderPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDownRef.current = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
    isDraggingRef.current = false;
    setDragTarget(null);
    tabBarTargetRef.current = null;
  }, [setDragTarget]);

  const handleHeaderPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const down = pointerDownRef.current;
    if (!down || down.pointerId !== e.pointerId) {
      return;
    }

    if (!isDraggingRef.current) {
      const dx = Math.abs(e.clientX - down.startX);
      const dy = Math.abs(e.clientY - down.startY);
      if (dx < 4 && dy < 4) {
        return;
      }
      isDraggingRef.current = true;
      setDragState({ draggedSessionId: sessionId, workspaceId });
    }

    // Try workspace-internal drop target first
    const target = resolveDropTarget(e.clientX, e.clientY, sessionId);
    if (target) {
      const prevTarget = dragTargetRef.current;
      if (target.targetSessionId !== prevTarget?.targetSessionId || target.side !== prevTarget?.side) {
        setDragTarget(target);
      }
      // Clear tab bar target
      if (tabBarTargetRef.current !== null) {
        tabBarTargetRef.current = null;
        workspaceService.setPaneToTabDrag(null);
      }
      return;
    }

    // Try tab bar drop target
    const tabTarget = resolveTabBarDropTarget(e.clientX, e.clientY);
    if (tabTarget) {
      tabBarTargetRef.current = tabTarget;
      workspaceService.setPaneToTabDrag({
        sessionId,
        workspaceId,
        dropIndex: tabTarget.dropIndex,
      });
      // Clear workspace internal target
      if (dragTargetRef.current !== null) {
        setDragTarget(null);
      }
      return;
    }

    // Neither target — clear both
    if (dragTargetRef.current !== null) {
      setDragTarget(null);
    }
    if (tabBarTargetRef.current !== null) {
      tabBarTargetRef.current = null;
      workspaceService.setPaneToTabDrag(null);
    }
  }, [sessionId, workspaceId, workspaceService, setDragState, setDragTarget]);

  const completeDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const down = pointerDownRef.current;
    if (!down || down.pointerId !== e.pointerId) {
      return;
    }
    pointerDownRef.current = null;

    if (e.currentTarget.hasPointerCapture(down.pointerId)) {
      e.currentTarget.releasePointerCapture(down.pointerId);
    }

    if (isDraggingRef.current) {
      const tabTarget = tabBarTargetRef.current;
      const wsTarget = dragTargetRef.current;

      if (tabTarget) {
        e.stopPropagation();
        portal.restoreHost(sessionId);
        workspaceService.extractSessionToTab(workspaceId, sessionId, tabTarget.targetTabId, tabTarget.position);
      } else if (wsTarget) {
        e.stopPropagation();
        onDrop(wsTarget.targetSessionId, wsTarget.side);
      }
    }

    isDraggingRef.current = false;
    tabBarTargetRef.current = null;
    workspaceService.setPaneToTabDrag(null);
    setDragTarget(null);
    setDragState(null);
  }, [onDrop, portal, sessionId, workspaceId, workspaceService, setDragState, setDragTarget]);

  if (!session) return null;

  const label = session.title || session.hostName;
  const isDragged = dragState?.draggedSessionId === sessionId;
  const isDropPreviewTarget = dragTarget?.targetSessionId === sessionId;
  const previewDropSide = isDropPreviewTarget ? dragTarget?.side : null;
  const canReceiveDrop = dragState !== null && dragState.draggedSessionId !== sessionId;
  const isFloatingMagnify = isMagnified || isExitingMagnify;

  return (
    <div
      ref={paneRef}
      className={cn(
        `
          tm:group/pane
          tm:flex tm:transform-gpu tm:flex-col tm:overflow-hidden tm:rounded-none
          tm:transition-[inset,opacity,transform,box-shadow,filter] tm:duration-220 tm:ease-out
        `,
        {
          'tm:bg-black/20': !isTransparent,
          'tm:fixed tm:inset-[3%] tm:z-50 tm:shadow-[0_18px_46px_rgba(0,0,0,0.32)]': isFloatingMagnify,
          'tm:animate-in tm:fade-in-0 tm:zoom-in-95 tm:slide-in-from-top-1': isMagnified,
          'tm:pointer-events-none tm:opacity-0 tm:duration-180': isExitingMagnify,
          'tm:relative tm:size-full': !isFloatingMagnify,
          'tm:opacity-45': isDragged,
        }
      )}
      {...{ [PANE_SESSION_ATTR]: sessionId }}
    >
      <div
        className={cn(
          'tm:pointer-events-none tm:absolute tm:inset-0 tm:z-1 tm:border tm:transition-colors tm:duration-150',
          {
            'tm:border-nord-blue/80': isFloatingMagnify,
            'tm:border-nord-blue/70': isActive && !isFloatingMagnify,
            'tm:border-line/35': !isActive && !isFloatingMagnify,
            'tm:border-blue/65': canReceiveDrop && isDropPreviewTarget,
          }
        )}
      />

      {/* Pane header — draggable area */}
      <div
        className={cn(
          `
            tm:flex tm:h-7 tm:shrink-0 tm:cursor-grab tm:items-center tm:gap-2 tm:border-b tm:px-2.5
            tm:transition-colors tm:duration-150 tm:select-none
            tm:active:cursor-grabbing
          `,
          {
            'tm:border-blue/40 tm:bg-one-bg/80': isActive || isFloatingMagnify,
            'tm:border-line/50 tm:bg-one-bg/40': !isActive && !isFloatingMagnify,
          }
        )}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={completeDrag}
        onPointerCancel={completeDrag}
      >
        {session.type === 'ssh'
          ? <ConnectionDot type={session.type} status={session.status} />
          : (
            <div className="tm:flex tm:size-4 tm:shrink-0 tm:items-center tm:justify-center">
              <PaneStatusIcon status={session.status} />
            </div>
          )}

        <span className="tm:flex-1 tm:truncate tm:text-[12px] tm:leading-none tm:font-medium tm:text-white">
          {label}
        </span>

        <div
          className={cn(
            'tm:flex tm:items-center tm:gap-0.5 tm:transition-opacity tm:duration-150',
            {
              'tm:opacity-100': isActive || isFloatingMagnify,
              'tm:opacity-0 tm:group-hover/pane:opacity-100': !isActive && !isFloatingMagnify,
            }
          )}
        >
          <PaneActionButton
            labelKey="terminal-ui.pane.split-right"
            onClick={(e) => {
              e.stopPropagation();
              handleSplit('horizontal');
            }}
            disabled={session.type === 'remote'}
          >
            <Columns2 size={12} strokeWidth={1.5} />
          </PaneActionButton>

          <PaneActionButton
            labelKey="terminal-ui.pane.split-down"
            onClick={(e) => {
              e.stopPropagation();
              handleSplit('vertical');
            }}
            disabled={session.type === 'remote'}
          >
            <Rows2 size={12} strokeWidth={1.5} />
          </PaneActionButton>

          <PaneActionButton
            labelKey={isMagnified ? 'terminal-ui.pane.restore' : 'terminal-ui.pane.maximize'}
            commandId={MaximizeSessionCommand.id}
            onClick={handleMagnify}
          >
            {isMagnified
              ? <Minimize2 size={12} strokeWidth={1.5} />
              : <Maximize2 size={12} strokeWidth={1.5} />}
          </PaneActionButton>

          <PaneActionButton
            labelKey="terminal-ui.pane.close"
            commandId={CloseActiveTabCommand.id}
            onClick={handleClose}
          >
            <X size={12} strokeWidth={1.5} />
          </PaneActionButton>
        </div>
      </div>

      <div ref={contentRef} className={cn('tm:relative tm:flex-1 tm:overflow-hidden', { 'tm:bg-black/10': !isTransparent })} />

      {canReceiveDrop && previewDropSide && (
        <>
          <div
            className={`
              tm:pointer-events-none tm:absolute tm:inset-0 tm:z-8 tm:bg-black/30 tm:backdrop-blur-[1.5px]
              tm:transition-opacity tm:duration-100
            `}
          />
          <div
            className={cn(
              `
                tm:pointer-events-none tm:absolute tm:z-10 tm:overflow-hidden tm:border tm:border-blue/65
                tm:bg-linear-to-br tm:from-blue/25 tm:via-blue/15 tm:to-transparent
                tm:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--tm-blue)_24%,transparent),0_10px_28px_color-mix(in_srgb,var(--tm-blue)_16%,transparent)]
                tm:transition-all tm:duration-100
              `,
              ZONE_STYLES[previewDropSide]
            )}
          >
            <DropZoneBadge side={previewDropSide} />
          </div>
        </>
      )}
    </div>
  );
}

function resolveDropTarget(clientX: number, clientY: number, draggedSessionId: string) {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!(hit instanceof HTMLElement)) return null;
  const paneEl = hit.closest<HTMLElement>(`[${PANE_SESSION_ATTR}]`);
  if (!paneEl) {
    return null;
  }

  const targetSessionId = paneEl.getAttribute(PANE_SESSION_ATTR);
  if (!targetSessionId || targetSessionId === draggedSessionId) return null;
  const side = getDropZone(clientX, clientY, paneEl.getBoundingClientRect());
  if (!side) {
    return null;
  }

  return { targetSessionId, side };
}

function resolveTabBarDropTarget(clientX: number, clientY: number): ITabBarDropTarget | null {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!(hit instanceof HTMLElement)) return null;

  const scrollContainer = hit.closest<HTMLElement>('[data-terminal-tabs-scroll]');
  if (!scrollContainer) return null;

  const tabItems = scrollContainer.querySelectorAll<HTMLElement>('[data-tab-item-id]');
  if (tabItems.length === 0) {
    return { dropIndex: 0 };
  }

  for (let i = 0; i < tabItems.length; i++) {
    const rect = tabItems[i].getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (clientX < midX) {
      const tabId = tabItems[i].getAttribute('data-tab-item-id') ?? undefined;
      return { dropIndex: i, targetTabId: tabId, position: 'before' };
    }
  }

  const lastTab = [...(tabItems || [])].at(-1);
  if (!lastTab) {
    return { dropIndex: 0 };
  }

  const lastTabId = lastTab.getAttribute('data-tab-item-id') ?? undefined;
  return { dropIndex: tabItems.length, targetTabId: lastTabId, position: 'after' };
}

function getDropZone(clientX: number, clientY: number, rect: DOMRect): DropSide | null {
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  if (relX >= 0.38 && relX <= 0.62 && relY >= 0.38 && relY <= 0.62) {
    return 'center';
  }

  const outerThreshold = 0.18;
  if (relX < outerThreshold) {
    return 'outer-left';
  }
  if (relX > 1 - outerThreshold) {
    return 'outer-right';
  }
  if (relY < outerThreshold) {
    return 'outer-top';
  }
  if (relY > 1 - outerThreshold) {
    return 'outer-bottom';
  }

  const centerRelX = relX - 0.5;
  const centerRelY = relY - 0.5;
  if (Math.abs(centerRelX) > Math.abs(centerRelY)) {
    return centerRelX > 0 ? 'right' : 'left';
  }
  return centerRelY > 0 ? 'bottom' : 'top';
}

const ZONE_STYLES: Record<DropSide, string> = {
  left: 'tm:left-[16%] tm:top-[18%] tm:h-[64%] tm:w-[32%]',
  right: 'tm:right-[16%] tm:top-[18%] tm:h-[64%] tm:w-[32%]',
  top: 'tm:left-[18%] tm:top-[16%] tm:h-[32%] tm:w-[64%]',
  bottom: 'tm:bottom-[16%] tm:left-[18%] tm:h-[32%] tm:w-[64%]',
  'outer-left': 'tm:left-[1.5%] tm:top-[1.5%] tm:h-[97%] tm:w-[22%]',
  'outer-right': 'tm:right-[1.5%] tm:top-[1.5%] tm:h-[97%] tm:w-[22%]',
  'outer-top': 'tm:left-[1.5%] tm:top-[1.5%] tm:h-[22%] tm:w-[97%]',
  'outer-bottom': 'tm:bottom-[1.5%] tm:left-[1.5%] tm:h-[22%] tm:w-[97%]',
  center: 'tm:left-[38%] tm:top-[38%] tm:h-[24%] tm:w-[24%]',
};

const DROP_ZONE_LABEL: Record<DropSide, string> = {
  left: 'Split Left',
  right: 'Split Right',
  top: 'Split Top',
  bottom: 'Split Bottom',
  'outer-left': 'Edge Left',
  'outer-right': 'Edge Right',
  'outer-top': 'Edge Top',
  'outer-bottom': 'Edge Bottom',
  center: 'Swap',
};

function DropZoneBadge({ side }: { side: DropSide }) {
  return (
    <span
      className={`
        tm:absolute tm:top-1/2 tm:left-1/2 tm:-translate-1/2 tm:text-[10px] tm:font-semibold tm:tracking-[0.08em]
        tm:text-white/95 tm:uppercase tm:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]
      `}
    >
      {DROP_ZONE_LABEL[side]}
    </span>
  );
}

function PaneStatusIcon({ status }: { status: TerminalSessionStatus }) {
  if (['connecting', 'authenticating', 'opening_shell'].includes(status)) {
    return <Loader2 size={13} strokeWidth={1.5} className="tm:animate-spin tm:text-white" />;
  }
  return <Terminal size={13} strokeWidth={1.5} className="tm:text-white" />;
}

function ConnectionDot({ type, status }: { type: string; status: TerminalSessionStatus }) {
  if (type !== 'ssh' || status === 'idle') return null;

  return (
    <div
      className={cn('tm:size-1.5 tm:shrink-0 tm:rounded-full', {
        'tm:bg-green': status === 'ready',
        'tm:animate-pulse tm:bg-yellow': ['connecting', 'authenticating', 'opening_shell'].includes(status),
        'tm:bg-red': status === 'error' || status === 'auth_failed',
        'tm:bg-grey': status === 'closed',
      })}
    />
  );
}

function PaneActionButton({ labelKey, commandId, onClick, children, disabled }: {
  labelKey: string;
  commandId?: string;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <TooltipWrapper side="bottom" labelKey={labelKey} commandId={commandId}>
      <Button
        variant="ghost"
        size="icon-xs"
        className="
          tm:size-5 tm:p-1 tm:duration-100
          tm:hover:bg-one-bg2
        "
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </Button>
    </TooltipWrapper>
  );
}
