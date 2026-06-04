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

import type { ITheme, Nullable } from '@termlnk/core';
import type { IPaneToTabDragState, ITabItem, IWorkspaceLayoutNode } from '../../models/workspace.model';
import type { ITerminalSession } from '../../services/terminal/terminal-ui.service';
import type { ISessionPortalRegistry } from '../workspace/session-portal-context';
import { IThemeService, Platform, platform } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { base46ToXterm, injectTransparencyToDOM, removeTransparencyFromDOM } from '@termlnk/themes';
import { BuiltInUIPart, useComponentsOfPart } from '@termlnk/ui';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ITerminalUIService } from '../../services/terminal/terminal-ui.service';
import { ITerminalViewRegistry } from '../../services/terminal/terminal-view-registry.service';
import { IWorkspaceService } from '../../services/workspace/workspace.service';
import { useWindowTransparency } from '../hooks';
import { TerminalTabs } from '../terminal-tabs/TerminalTabs';
import { useTabDisplayItems } from '../terminal-tabs/use-tab-display-items';
import { cleanupRemovedSessionHosts } from '../workspace/session-dom-lifecycle';
import { SessionPortalContext } from '../workspace/session-portal-context';
import { WorkspaceContainer } from '../workspace/WorkspaceContainer';

function collectSessionIds(node: IWorkspaceLayoutNode): string[] {
  if (node.type === 'leaf') return [node.sessionId];
  return node.children.flatMap(collectSessionIds);
}

function createSessionHostElement(): HTMLDivElement {
  const hostElement = document.createElement('div');
  hostElement.className = 'tm:size-full';
  return hostElement;
}

export function TerminalContainer(): React.JSX.Element {
  const terminalUIService = useDependency(ITerminalUIService);
  const workspaceService = useDependency(IWorkspaceService);
  const themeService = useDependency(IThemeService);
  const viewRegistry = useDependency(ITerminalViewRegistry);

  const sessions = useObservable<ITerminalSession[]>(terminalUIService.sessions$, []);
  const tabItems = useObservable<ITabItem[]>(workspaceService.tabItems$, []);
  const workspaces = useObservable(workspaceService.workspaces$, []);
  const activeTabItemId = useObservable<Nullable<string>>(workspaceService.activeTabItemId$);
  const currentTheme = useObservable<ITheme | null>(themeService.currentTheme$);
  const transparency = useWindowTransparency();
  const usesDomTransparency = platform !== Platform.Windows;

  const backgroundOpacity = transparency.enabled && usesDomTransparency ? transparency.opacity : undefined;
  const allowTransparency = usesDomTransparency && transparency.enabled && transparency.opacity < 1;

  const xtermTheme = useMemo(
    () => currentTheme ? base46ToXterm(currentTheme, backgroundOpacity) : undefined,
    [currentTheme, backgroundOpacity]
  );

  // Inject/remove CSS transparency overrides when theme or opacity changes
  useEffect(() => {
    if (!currentTheme) return;
    if (usesDomTransparency && transparency.enabled && transparency.opacity < 1) {
      injectTransparencyToDOM(currentTheme, transparency.opacity);
    } else {
      removeTransparencyFromDOM();
    }
  }, [currentTheme, transparency.enabled, transparency.opacity, usesDomTransparency]);

  // Session host registry for DOM reparenting. React renders into these hosts via portals,
  // while workspace panes only move the hosts themselves.
  const sessionHostElementsRef = useRef(new Map<string, HTMLDivElement>());
  const sessionHomeContainersRef = useRef(new Map<string, HTMLDivElement>());
  const previousSessionIdsRef = useRef<Set<string>>(new Set());

  const getSessionHostElement = useCallback((sessionId: string): HTMLDivElement | null => {
    return sessionHostElementsRef.current.get(sessionId) ?? null;
  }, []);

  const ensureSessionHostElement = useCallback((sessionId: string): HTMLDivElement => {
    const existingHostElement = getSessionHostElement(sessionId);
    if (existingHostElement) {
      return existingHostElement;
    }

    const nextHostElement = createSessionHostElement();
    sessionHostElementsRef.current.set(sessionId, nextHostElement);
    return nextHostElement;
  }, [getSessionHostElement]);

  const restoreSessionHost = useCallback((sessionId: string): void => {
    const sessionHostElement = getSessionHostElement(sessionId);
    const sessionHomeContainer = sessionHomeContainersRef.current.get(sessionId);
    if (!sessionHostElement || !sessionHomeContainer) {
      return;
    }

    if (sessionHostElement.parentElement !== sessionHomeContainer) {
      sessionHomeContainer.appendChild(sessionHostElement);
    }
  }, [getSessionHostElement]);

  const setSessionHomeContainer = useCallback((sessionId: string, element: HTMLDivElement | null): void => {
    if (element) {
      sessionHomeContainersRef.current.set(sessionId, element);
      return;
    }

    sessionHomeContainersRef.current.delete(sessionId);
  }, []);

  const portalRegistry = useMemo<ISessionPortalRegistry>(() => ({
    getHostElement: getSessionHostElement,
    restoreHost: restoreSessionHost,
  }), [getSessionHostElement, restoreSessionHost]);

  useEffect(() => {
    const nextSessionIds = new Set(sessions.map((session) => session.id));

    cleanupRemovedSessionHosts({
      previousSessionIds: previousSessionIdsRef.current,
      nextSessionIds,
      restoreSessionHost,
      getSessionHostElement,
      deleteSessionHostElement: (sessionId) => {
        sessionHostElementsRef.current.delete(sessionId);
      },
      deleteSessionHomeContainer: (sessionId) => {
        sessionHomeContainersRef.current.delete(sessionId);
      },
    });

    previousSessionIdsRef.current = nextSessionIds;
  }, [sessions, restoreSessionHost, getSessionHostElement]);

  useEffect(() => {
    const subscription = workspaceService.beforeRemoveSessions$.subscribe((sessionIds) => {
      for (const sessionId of sessionIds) {
        restoreSessionHost(sessionId);
      }
    });
    return () => subscription.unsubscribe();
  }, [workspaceService, restoreSessionHost]);

  const displayItems = useTabDisplayItems(tabItems, sessions, workspaceService);

  const handleSelectTab = useCallback((id: string) => {
    workspaceService.setActiveTabItem(id);
  }, [workspaceService]);

  const handleCloseTab = useCallback((id: string) => {
    workspaceService.removeTabItem(id);
  }, [workspaceService]);

  const handleReorderTab = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
    workspaceService.moveTabItem(sourceId, targetId, position);
  }, [workspaceService]);

  const handleMergeTab = useCallback((sourceId: string, targetId: string) => {
    workspaceService.mergeTwoSessions(sourceId, targetId);
  }, [workspaceService]);

  const addSessionHandler = useObservable(viewRegistry.addSessionHandler$, undefined);
  const paneToTabDrag = useObservable<IPaneToTabDragState | null>(workspaceService.paneToTabDrag$, null);

  const headerComponents = useComponentsOfPart(BuiltInUIPart.HEADER);
  const showLocalTabs = headerComponents.length === 0;

  const workspaceSessionIds = useMemo(
    () => new Set(workspaces.flatMap((ws) => collectSessionIds(ws.layout))),
    [workspaces]
  );

  useLayoutEffect(() => {
    for (const session of sessions) {
      if (workspaceSessionIds.has(session.id)) {
        continue;
      }

      restoreSessionHost(session.id);
    }
  }, [sessions, workspaceSessionIds, restoreSessionHost]);

  // Determine if active tab is a workspace
  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === activeTabItemId),
    [workspaces, activeTabItemId]
  );

  return (
    <SessionPortalContext.Provider value={portalRegistry}>
      <div
        className={`
          tm:row-span-full tm:flex tm:size-full tm:flex-col
          tm:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tm-black)_96%,transparent),color-mix(in_srgb,var(--tm-darker-black)_98%,transparent))]
        `}
      >
        {showLocalTabs && (
          <TerminalTabs
            items={displayItems}
            activeTabItemId={activeTabItemId}
            externalDragDropIndex={paneToTabDrag?.dropIndex}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onReorderTab={handleReorderTab}
            onMergeTab={handleMergeTab}
            onAddSession={addSessionHandler}
          />
        )}
        <div className="tm:relative tm:flex-1 tm:overflow-hidden">
          {sessions.length === 0
            ? (
              <div
                className="tm:flex tm:size-full tm:items-center tm:justify-center"
              />
            )
            : (
              <>
                {/* ALL sessions rendered here — workspace sessions are hidden and reparented by WorkspacePane */}
                {sessions.map((session) => {
                  const ViewComponent = viewRegistry.getView(session.type);
                  if (!ViewComponent) return null;

                  const isInWorkspace = workspaceSessionIds.has(session.id);
                  const isStandaloneActive = !isInWorkspace && session.id === activeTabItemId && !activeWorkspace;

                  return (
                    <Fragment key={session.id}>
                      <div
                        ref={(element) => setSessionHomeContainer(session.id, element)}
                        className={cn('tm:absolute tm:inset-0', {
                          'tm:z-10': isStandaloneActive,
                          'tm:pointer-events-none tm:z-0 tm:opacity-0': !isStandaloneActive,
                        })}
                      />
                      {createPortal(
                        <ViewComponent
                          sessionId={session.id}
                          hostId={session.hostId}
                          hostName={session.hostName}
                          theme={xtermTheme}
                          allowTransparency={allowTransparency}
                        />,
                        ensureSessionHostElement(session.id),
                        session.id
                      )}
                    </Fragment>
                  );
                })}

                {/* Workspaces — panes will reparent session elements via SessionPortalContext */}
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className={cn('tm:absolute tm:inset-0', {
                      'tm:z-10': ws.id === activeTabItemId,
                      'tm:pointer-events-none tm:z-0 tm:opacity-0': ws.id !== activeTabItemId,
                    })}
                  >
                    <WorkspaceContainer workspaceId={ws.id} />
                  </div>
                ))}
              </>
            )}
        </div>
      </div>
    </SessionPortalContext.Provider>
  );
}
