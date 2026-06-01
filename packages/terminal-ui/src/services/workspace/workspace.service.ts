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

import type { Observable } from 'rxjs';
import type { DropSide, IMagnifyState, IPaneToTabDragState, ITabItem, IWorkspace, IWorkspaceLayoutBranch, IWorkspaceLayoutNode, WorkspaceLayoutDirection } from '../../models/workspace.model';
import type { ITerminalSession } from '../terminal/terminal-ui.service';
import { createIdentifier, Disposable, ILogService } from '@termlnk/core';
import { nanoid } from 'nanoid';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, Subject } from 'rxjs';
import { ITerminalUIService } from '../terminal/terminal-ui.service';

function collectSessionIds(node: IWorkspaceLayoutNode): string[] {
  if (node.type === 'leaf') return [node.sessionId];
  return node.children.flatMap(collectSessionIds);
}

function removeSessionFromNode(node: IWorkspaceLayoutNode, sessionId: string): IWorkspaceLayoutNode | null {
  if (node.type === 'leaf') {
    return node.sessionId === sessionId ? null : node;
  }

  const newChildren: IWorkspaceLayoutNode[] = [];
  const newSizes: number[] = [];
  let removedSize = 0;

  for (let i = 0; i < node.children.length; i++) {
    const result = removeSessionFromNode(node.children[i], sessionId);
    if (result) {
      newChildren.push(result);
      newSizes.push(node.sizes[i]);
    } else {
      removedSize += node.sizes[i];
    }
  }

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];

  // Redistribute removed size proportionally
  const total = newSizes.reduce((a, b) => a + b, 0);
  const adjustedSizes = newSizes.map((s) => (s / total) * (total + removedSize));

  return { ...node, children: newChildren, sizes: adjustedSizes };
}

function insertSessionIntoNode(
  rootNode: IWorkspaceLayoutNode,
  targetSessionId: string,
  newSessionId: string,
  side: DropSide
): IWorkspaceLayoutNode {
  if (side === 'center') {
    return swapSession(rootNode, targetSessionId, newSessionId);
  }

  const isOuter = side.startsWith('outer-');
  const baseSide = isOuter ? side.replace('outer-', '') as 'left' | 'right' | 'top' | 'bottom' : side as 'left' | 'right' | 'top' | 'bottom';
  const direction: 'horizontal' | 'vertical' = (baseSide === 'left' || baseSide === 'right') ? 'horizontal' : 'vertical';
  const insertBefore = baseSide === 'left' || baseSide === 'top';

  if (isOuter) {
    return insertAtParentLevel(rootNode, targetSessionId, newSessionId, direction, insertBefore);
  }

  return insertAtLeafLevel(rootNode, targetSessionId, newSessionId, direction, insertBefore);
}

function insertAtLeafLevel(
  node: IWorkspaceLayoutNode,
  targetSessionId: string,
  newSessionId: string,
  direction: 'horizontal' | 'vertical',
  insertBefore: boolean
): IWorkspaceLayoutNode {
  if (node.type === 'leaf') {
    if (node.sessionId !== targetSessionId) return node;

    const newLeaf: IWorkspaceLayoutNode = { type: 'leaf', sessionId: newSessionId };
    const children = insertBefore ? [newLeaf, node] : [node, newLeaf];
    return { type: 'branch', direction, children, sizes: [50, 50] };
  }

  return {
    ...node,
    children: node.children.map((child) =>
      insertAtLeafLevel(child, targetSessionId, newSessionId, direction, insertBefore)
    ),
  };
}

function insertAtParentLevel(
  node: IWorkspaceLayoutNode,
  targetSessionId: string,
  newSessionId: string,
  direction: 'horizontal' | 'vertical',
  insertBefore: boolean
): IWorkspaceLayoutNode {
  if (node.type === 'leaf') {
    if (node.sessionId !== targetSessionId) return node;
    const newLeaf: IWorkspaceLayoutNode = { type: 'leaf', sessionId: newSessionId };
    const children = insertBefore ? [newLeaf, node] : [node, newLeaf];
    return { type: 'branch', direction, children, sizes: [50, 50] };
  }

  // Check if any direct child contains the target
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (containsSession(child, targetSessionId)) {
      if (node.direction === direction) {
        // Same direction → insert as sibling
        const newLeaf: IWorkspaceLayoutNode = { type: 'leaf', sessionId: newSessionId };
        const insertIndex = insertBefore ? i : i + 1;
        const newChildren = [...node.children];
        const newSizes = [...node.sizes];
        const shareSize = node.sizes[i] / 2;
        newSizes[i] = shareSize;
        newChildren.splice(insertIndex, 0, newLeaf);
        newSizes.splice(insertIndex, 0, shareSize);
        return { ...node, children: newChildren, sizes: newSizes };
      }

      // Different direction → recurse or wrap
      return {
        ...node,
        children: node.children.map((c, idx) =>
          idx === i ? insertAtParentLevel(c, targetSessionId, newSessionId, direction, insertBefore) : c
        ),
      };
    }
  }

  return node;
}

function containsSession(node: IWorkspaceLayoutNode, sessionId: string): boolean {
  if (node.type === 'leaf') return node.sessionId === sessionId;
  return node.children.some((child) => containsSession(child, sessionId));
}

function swapSession(node: IWorkspaceLayoutNode, targetSessionId: string, newSessionId: string): IWorkspaceLayoutNode {
  if (node.type === 'leaf') {
    return node.sessionId === targetSessionId
      ? { type: 'leaf', sessionId: newSessionId }
      : node;
  }
  return {
    ...node,
    children: node.children.map((child) => swapSession(child, targetSessionId, newSessionId)),
  };
}

function swapTwoSessions(node: IWorkspaceLayoutNode, sessionIdA: string, sessionIdB: string): IWorkspaceLayoutNode {
  if (sessionIdA === sessionIdB) return node;

  if (node.type === 'leaf') {
    if (node.sessionId === sessionIdA) {
      return { type: 'leaf', sessionId: sessionIdB };
    }
    if (node.sessionId === sessionIdB) {
      return { type: 'leaf', sessionId: sessionIdA };
    }
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) => swapTwoSessions(child, sessionIdA, sessionIdB)),
  };
}

function updateSizesAtPath(node: IWorkspaceLayoutNode, path: number[], sizes: number[]): IWorkspaceLayoutNode {
  if (path.length === 0) {
    if (node.type === 'branch') {
      return { ...node, sizes };
    }
    return node;
  }

  if (node.type !== 'branch') return node;

  const [head, ...rest] = path;
  return {
    ...node,
    children: node.children.map((child, i) =>
      i === head ? updateSizesAtPath(child, rest, sizes) : child
    ),
  };
}

export interface IWorkspaceService {
  readonly tabItems$: Observable<ITabItem[]>;
  readonly activeTabItemId$: Observable<string | null>;
  readonly magnifyState$: Observable<IMagnifyState | null>;
  readonly workspaces$: Observable<IWorkspace[]>;
  readonly beforeRemoveSessions$: Observable<string[]>;

  // Tab operations
  setActiveTabItem(id: string): void;
  getActiveTabItemId(): string | null;
  removeTabItem(id: string): void;
  moveTabItem(sourceId: string, targetId: string, position: 'before' | 'after'): void;

  // Workspace CRUD
  createWorkspace(sessionIds: string[], name?: string): string;
  dissolveWorkspace(workspaceId: string): void;
  getWorkspace(workspaceId: string): IWorkspace | undefined;
  getAllWorkspaces(): IWorkspace[];

  // Merge operations
  mergeSessionIntoWorkspace(sessionId: string, workspaceId: string, targetSessionId: string, side: DropSide): void;
  mergeTwoSessions(sessionIdA: string, sessionIdB: string, side?: DropSide): string;

  /**
   * Attach an existing session as a new pane beside a source session. If the source is a
   * standalone tab it is promoted into a new workspace honoring the split direction; if it
   * already lives in a workspace the pane is inserted next to it. The new pane is focused.
   */
  splitSession(sourceSessionId: string, newSessionId: string, side: DropSide): void;

  // Layout operations
  updatePanelSizes(workspaceId: string, branchPath: number[], sizes: number[]): void;
  setActiveSessionInWorkspace(workspaceId: string, sessionId: string): void;
  removeSessionFromWorkspace(workspaceId: string, sessionId: string): void;
  moveSessionInWorkspace(workspaceId: string, sessionId: string, targetSessionId: string, side: DropSide): void;

  // Magnify
  toggleMagnify(workspaceId: string, sessionId: string): void;
  clearMagnify(): void;

  // Pane-to-tab drag
  readonly paneToTabDrag$: Observable<IPaneToTabDragState | null>;
  setPaneToTabDrag(state: IPaneToTabDragState | null): void;
  extractSessionToTab(workspaceId: string, sessionId: string, targetTabId?: string, position?: 'before' | 'after'): void;

  // Query
  getWorkspaceForSession(sessionId: string): IWorkspace | undefined;
  isSessionInWorkspace(sessionId: string): boolean;
  getSessionCountInWorkspace(workspaceId: string): number;

  // Persistence helpers
  restoreWorkspaces(workspaces: IWorkspace[], tabItemOrder: string[], activeTabItemId: string | null): void;
  getTabItemOrder(): string[];
}

export const IWorkspaceService = createIdentifier<IWorkspaceService>('terminal-ui.workspace-service');

export class WorkspaceService extends Disposable implements IWorkspaceService {
  private readonly _workspaces$ = new BehaviorSubject<IWorkspace[]>([]);
  readonly workspaces$ = this._workspaces$.asObservable();
  private readonly _beforeRemoveSessions$ = new Subject<string[]>();
  readonly beforeRemoveSessions$ = this._beforeRemoveSessions$.asObservable();

  private readonly _tabItemOrder$ = new BehaviorSubject<string[]>([]);

  private readonly _activeTabItemId$ = new BehaviorSubject<string | null>(null);
  readonly activeTabItemId$: Observable<string | null> = this._activeTabItemId$.asObservable();

  private readonly _magnifyState$ = new BehaviorSubject<IMagnifyState | null>(null);
  readonly magnifyState$: Observable<IMagnifyState | null> = this._magnifyState$.asObservable();

  private readonly _paneToTabDrag$ = new BehaviorSubject<IPaneToTabDragState | null>(null);
  readonly paneToTabDrag$: Observable<IPaneToTabDragState | null> = this._paneToTabDrag$.asObservable();

  readonly tabItems$: Observable<ITabItem[]>;

  private _initialSyncDone = false;

  constructor(
    @ITerminalUIService private readonly _terminalUIService: ITerminalUIService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    // Compute tab items from tab order + workspaces + sessions
    this.tabItems$ = combineLatest([
      this._tabItemOrder$,
      this._workspaces$,
      this._terminalUIService.sessions$,
    ]).pipe(
      map(([order, workspaces, sessions]) => {
        const workspaceMap = new Map(workspaces.map((w) => [w.id, w]));
        const workspaceSessionIds = new Set(workspaces.flatMap((w) => collectSessionIds(w.layout)));
        const standaloneSessions = sessions.filter((s) => !workspaceSessionIds.has(s.id));
        const standaloneMap = new Map(standaloneSessions.map((s) => [s.id, s]));

        // Items that exist in the order
        const result: ITabItem[] = [];
        const seenIds = new Set<string>();

        for (const id of order) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          if (workspaceMap.has(id)) {
            result.push({ type: 'workspace', workspaceId: id });
          } else if (standaloneMap.has(id)) {
            result.push({ type: 'session', sessionId: id });
          }
        }

        // Append any new standalone sessions not in order
        for (const s of standaloneSessions) {
          if (!seenIds.has(s.id)) {
            result.push({ type: 'session', sessionId: s.id });
          }
        }

        return result;
      }),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );

    // Subscribe to session changes for auto-sync
    this.disposeWithMe(
      this._terminalUIService.sessions$.subscribe((sessions) => {
        this._syncWithSessions(sessions);
      })
    );

    // Sync activeTabItemId from terminalUIService when no workspace is active
    this.disposeWithMe(
      this._terminalUIService.activeSessionId$.subscribe((sessionId) => {
        if (!sessionId) return;
        // If the active session is standalone, sync
        if (!this.isSessionInWorkspace(sessionId)) {
          if (this._activeTabItemId$.value !== sessionId) {
            this._activeTabItemId$.next(sessionId);
          }
        }
      })
    );
  }

  private _syncWithSessions(sessions: ITerminalSession[]): void {
    const sessionIds = new Set(sessions.map((s) => s.id));
    const workspaces = this._workspaces$.value;
    const workspaceSessionIds = new Set(workspaces.flatMap((w) => collectSessionIds(w.layout)));

    // Add new standalone sessions to tab order
    const order = [...this._tabItemOrder$.value];
    const orderSet = new Set(order);
    let orderChanged = false;

    for (const s of sessions) {
      if (!workspaceSessionIds.has(s.id) && !orderSet.has(s.id)) {
        order.push(s.id);
        orderSet.add(s.id);
        orderChanged = true;
      }
    }

    // Remove stale standalone sessions from tab order
    const workspaceIds = new Set(workspaces.map((w) => w.id));
    const filteredOrder = order.filter((id) => {
      if (workspaceIds.has(id)) return true;
      return sessionIds.has(id);
    });
    if (filteredOrder.length !== order.length) {
      orderChanged = true;
    }

    if (orderChanged) {
      this._tabItemOrder$.next(filteredOrder);
    }

    // Clean up workspaces: remove sessions that no longer exist
    let workspacesChanged = false;
    const updatedWorkspaces = workspaces.map((ws) => {
      const wsSessionIds = collectSessionIds(ws.layout);
      const removedIds = wsSessionIds.filter((id) => !sessionIds.has(id));
      if (removedIds.length === 0) {
        return ws;
      }

      workspacesChanged = true;
      let layout = ws.layout;
      for (const id of removedIds) {
        const result = removeSessionFromNode(layout, id);
        if (!result) {
          // All sessions removed
          return null;
        }
        layout = result;
      }

      const activeSessionId = ws.activeSessionId && sessionIds.has(ws.activeSessionId)
        ? ws.activeSessionId
        : collectSessionIds(layout)[0] ?? null;

      return { ...ws, layout, activeSessionId };
    }).filter((ws): ws is IWorkspace => ws !== null);

    if (workspacesChanged) {
      // Check for auto-degrade (workspace with only 1 session)
      const finalWorkspaces: IWorkspace[] = [];
      const degradedMap = new Map<string, string>(); // workspaceId → sessionId

      for (const ws of updatedWorkspaces) {
        const ids = collectSessionIds(ws.layout);
        if (ids.length <= 1) {
          degradedMap.set(ws.id, ids[0] ?? '');
        } else {
          finalWorkspaces.push(ws);
        }
      }

      this._workspaces$.next(finalWorkspaces);

      // Update tab order: replace workspace IDs with session IDs for degraded workspaces
      if (degradedMap.size > 0) {
        const newOrder = this._tabItemOrder$.value.flatMap((id) => {
          if (degradedMap.has(id)) {
            const sessionId = degradedMap.get(id)!;
            return sessionId ? [sessionId] : [];
          }
          // Remove workspace IDs that were dissolved
          const wsIds = new Set(finalWorkspaces.map((w) => w.id));
          if (!wsIds.has(id) && !sessionIds.has(id)) return [];
          return [id];
        });
        this._tabItemOrder$.next(newOrder);

        // Update active tab item if needed
        const activeId = this._activeTabItemId$.value;
        if (activeId && degradedMap.has(activeId)) {
          const sessionId = degradedMap.get(activeId)!;
          if (sessionId) {
            this._activeTabItemId$.next(sessionId);
            this._terminalUIService.setActiveSession(sessionId);
          }
        }

        // Clear magnify if workspace was dissolved
        const mag = this._magnifyState$.value;
        if (mag && degradedMap.has(mag.workspaceId)) {
          this._magnifyState$.next(null);
        }
      }
    }

    this._ensureValidActiveTab(sessions);

    // Auto-select first tab if nothing is active
    if (!this._initialSyncDone && sessions.length > 0) {
      this._initialSyncDone = true;
    }
  }

  private _ensureValidActiveTab(sessions: ITerminalSession[]): void {
    const workspaces = this._workspaces$.value;
    const order = this._tabItemOrder$.value;

    const workspaceIds = new Set(workspaces.map((ws) => ws.id));
    const workspaceSessionIds = new Set(workspaces.flatMap((ws) => collectSessionIds(ws.layout)));
    const standaloneSessions = sessions.filter((s) => !workspaceSessionIds.has(s.id));
    const standaloneSessionIds = new Set(standaloneSessions.map((s) => s.id));

    const activeId = this._activeTabItemId$.value;
    const isValidActiveId = Boolean(activeId && (workspaceIds.has(activeId) || standaloneSessionIds.has(activeId)));
    if (isValidActiveId) {
      return;
    }

    const activeSessionId = this._terminalUIService.getActiveSessionId();
    let nextActiveTabId: string | null = null;

    if (activeSessionId) {
      const ws = workspaces.find((w) => containsSession(w.layout, activeSessionId));
      if (ws) {
        nextActiveTabId = ws.id;
      } else if (standaloneSessionIds.has(activeSessionId)) {
        nextActiveTabId = activeSessionId;
      }
    }

    if (!nextActiveTabId) {
      nextActiveTabId = order.find((id) => workspaceIds.has(id) || standaloneSessionIds.has(id)) ?? null;
    }

    if (!nextActiveTabId) {
      nextActiveTabId = workspaces[0]?.id ?? standaloneSessions[0]?.id ?? null;
    }

    if (this._activeTabItemId$.value !== nextActiveTabId) {
      this._activeTabItemId$.next(nextActiveTabId);
    }

    if (!nextActiveTabId) {
      this._terminalUIService.setActiveSession(null);
      return;
    }

    const ws = workspaces.find((w) => w.id === nextActiveTabId);
    if (ws?.activeSessionId) {
      this._terminalUIService.setActiveSession(ws.activeSessionId);
    } else if (!ws) {
      this._terminalUIService.setActiveSession(nextActiveTabId);
    }
  }

  setActiveTabItem(id: string): void {
    if (this._activeTabItemId$.value === id) return;
    this._activeTabItemId$.next(id);

    // If it's a workspace, set the workspace's active session
    const ws = this.getWorkspace(id);
    if (ws?.activeSessionId) {
      this._terminalUIService.setActiveSession(ws.activeSessionId);
    } else if (!ws) {
      // It's a standalone session
      this._terminalUIService.setActiveSession(id);
    }
  }

  getActiveTabItemId(): string | null {
    return this._activeTabItemId$.value;
  }

  removeTabItem(id: string): void {
    const ws = this.getWorkspace(id);
    if (ws) {
      const sessionIds = collectSessionIds(ws.layout);
      this._beforeRemoveSessions$.next(sessionIds);

      // Dissolve first so workspace panes unmount and restore reparented session nodes
      // before React removes the underlying session components.
      this.dissolveWorkspace(id);

      // Then remove all sessions that originally belonged to this workspace.
      for (const sid of sessionIds) {
        this._terminalUIService.removeSession(sid);
      }
    } else {
      this._beforeRemoveSessions$.next([id]);
      // Remove standalone session
      this._terminalUIService.removeSession(id);
    }
  }

  moveTabItem(sourceId: string, targetId: string, position: 'before' | 'after'): void {
    const order = [...this._tabItemOrder$.value];
    const fromIndex = order.indexOf(sourceId);
    if (fromIndex === -1) return;

    order.splice(fromIndex, 1);
    const targetIndex = order.indexOf(targetId);
    if (targetIndex === -1) {
      order.push(sourceId);
    } else {
      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
      order.splice(insertIndex, 0, sourceId);
    }
    this._tabItemOrder$.next(order);
  }

  createWorkspace(sessionIds: string[], name?: string): string {
    if (sessionIds.length < 2) {
      throw new Error('Workspace requires at least 2 sessions');
    }

    const children: IWorkspaceLayoutNode[] = sessionIds.map((sid) => ({ type: 'leaf' as const, sessionId: sid }));
    const sizes = Array.from({ length: sessionIds.length }).fill(100 / sessionIds.length) as number[];
    const layout: IWorkspaceLayoutBranch = { type: 'branch', direction: 'horizontal', children, sizes };

    return this._registerWorkspace(layout, sessionIds[0], name);
  }

  /**
   * Register a freshly-built branch layout as a new workspace: insert it into the tab order
   * in place of the sessions it absorbs (keeping their earliest slot) and focus the given
   * session. Shared by every code path that turns standalone sessions into a workspace.
   */
  private _registerWorkspace(layout: IWorkspaceLayoutBranch, activeSessionId: string, name?: string): string {
    const sessionIds = collectSessionIds(layout);
    const id = `ws_${nanoid()}`;
    const workspace: IWorkspace = { id, name: name ?? 'Workspace', layout, activeSessionId };
    this._workspaces$.next([...this._workspaces$.value, workspace]);

    // Replace the absorbed sessions in the tab order with the workspace, anchored at the
    // earliest slot they occupied.
    const order = this._tabItemOrder$.value;
    const anchorIndex = Math.min(...sessionIds.map((sid) => order.indexOf(sid)).filter((i) => i >= 0));
    const absorbed = new Set(sessionIds);
    const newOrder = order.filter((tabId) => !absorbed.has(tabId));
    newOrder.splice(Number.isFinite(anchorIndex) ? Math.min(anchorIndex, newOrder.length) : newOrder.length, 0, id);
    this._tabItemOrder$.next(newOrder);

    this._activeTabItemId$.next(id);
    this._terminalUIService.setActiveSession(activeSessionId);

    this._logService.debug('[WorkspaceService]', `Created workspace ${id} with ${sessionIds.length} sessions`);
    return id;
  }

  dissolveWorkspace(workspaceId: string): void {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return;

    const sessionIds = collectSessionIds(ws.layout);
    this._workspaces$.next(this._workspaces$.value.filter((w) => w.id !== workspaceId));

    // Replace workspace in tab order with its sessions
    const order = this._tabItemOrder$.value;
    const wsIndex = order.indexOf(workspaceId);
    if (wsIndex >= 0) {
      const newOrder = [...order];
      newOrder.splice(wsIndex, 1, ...sessionIds);
      this._tabItemOrder$.next(newOrder);
    }

    // Update active tab
    if (this._activeTabItemId$.value === workspaceId) {
      const activeSession = ws.activeSessionId ?? sessionIds[0];
      if (activeSession) {
        this._activeTabItemId$.next(activeSession);
        this._terminalUIService.setActiveSession(activeSession);
      }
    }

    // Clear magnify
    if (this._magnifyState$.value?.workspaceId === workspaceId) {
      this._magnifyState$.next(null);
    }
  }

  getWorkspace(workspaceId: string): IWorkspace | undefined {
    return this._workspaces$.value.find((w) => w.id === workspaceId);
  }

  getAllWorkspaces(): IWorkspace[] {
    return [...this._workspaces$.value];
  }

  mergeSessionIntoWorkspace(sessionId: string, workspaceId: string, targetSessionId: string, side: DropSide): void {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return;

    const newLayout = insertSessionIntoNode(ws.layout, targetSessionId, sessionId, side);
    const updated: IWorkspace = { ...ws, layout: newLayout };
    this._workspaces$.next(
      this._workspaces$.value.map((w) => w.id === workspaceId ? updated : w)
    );

    // Remove from standalone tab order
    const order = this._tabItemOrder$.value.filter((id) => id !== sessionId);
    this._tabItemOrder$.next(order);
  }

  mergeTwoSessions(sessionIdA: string, sessionIdB: string, side?: DropSide): string {
    // If B is a workspace ID (tab item is a workspace), merge A into that workspace
    const directWsB = this.getWorkspace(sessionIdB);
    if (directWsB) {
      const directWsA = this.getWorkspace(sessionIdA);
      if (directWsA) {
        // Both are workspaces → merge all sessions from A into B
        const workspaceId = this._mergeWorkspaces(directWsA, directWsB, side ?? 'right');
        this.setActiveTabItem(workspaceId);
        return workspaceId;
      }
      // A is a session (standalone or in workspace), merge into B
      const wsA = this.getWorkspaceForSession(sessionIdA);
      if (wsA) {
        // A is in a workspace → remove from that workspace first
        this._removeSessionFromLayout(wsA.id, sessionIdA);
      }
      const targetSession = directWsB.activeSessionId ?? collectSessionIds(directWsB.layout)[0];
      if (targetSession) {
        this.mergeSessionIntoWorkspace(sessionIdA, directWsB.id, targetSession, side ?? 'right');
      }
      this.setActiveTabItem(directWsB.id);
      return directWsB.id;
    }

    // If B is already in a workspace, merge A into it
    const wsB = this.getWorkspaceForSession(sessionIdB);
    if (wsB) {
      const directWsA = this.getWorkspace(sessionIdA);
      if (directWsA) {
        // A is a workspace → merge all sessions from A into B's workspace
        const workspaceId = this._mergeWorkspaces(directWsA, wsB, side ?? 'right');
        this.setActiveTabItem(workspaceId);
        return workspaceId;
      }
      this.mergeSessionIntoWorkspace(sessionIdA, wsB.id, sessionIdB, side ?? 'right');
      this.setActiveTabItem(wsB.id);
      return wsB.id;
    }

    // If A is a workspace ID, merge B into that workspace
    const directWsA = this.getWorkspace(sessionIdA);
    if (directWsA) {
      const targetSession = directWsA.activeSessionId ?? collectSessionIds(directWsA.layout)[0];
      if (targetSession) {
        this.mergeSessionIntoWorkspace(sessionIdB, directWsA.id, targetSession, side ?? 'right');
      }
      this.setActiveTabItem(directWsA.id);
      return directWsA.id;
    }

    // If A is already in a workspace, merge B into it
    const wsA = this.getWorkspaceForSession(sessionIdA);
    if (wsA) {
      this.mergeSessionIntoWorkspace(sessionIdB, wsA.id, sessionIdA, side ?? 'right');
      this.setActiveTabItem(wsA.id);
      return wsA.id;
    }

    // Both are standalone → create new workspace
    const workspaceId = this.createWorkspace([sessionIdB, sessionIdA]);
    this.setActiveTabItem(workspaceId);
    return workspaceId;
  }

  splitSession(sourceSessionId: string, newSessionId: string, side: DropSide): void {
    const ws = this.getWorkspaceForSession(sourceSessionId);
    if (ws) {
      this.mergeSessionIntoWorkspace(newSessionId, ws.id, sourceSessionId, side);
      this.setActiveSessionInWorkspace(ws.id, newSessionId);
      return;
    }

    // Source is a standalone tab: promote both into a fresh workspace, already focused on
    // the new pane by _registerWorkspace.
    this._createWorkspaceFromSplit(sourceSessionId, newSessionId, side);
  }

  private _createWorkspaceFromSplit(sourceSessionId: string, newSessionId: string, side: DropSide): string {
    const direction: WorkspaceLayoutDirection = side === 'left' || side === 'right' ? 'horizontal' : 'vertical';
    const insertBefore = side === 'left' || side === 'top';
    const sourceLeaf: IWorkspaceLayoutNode = { type: 'leaf', sessionId: sourceSessionId };
    const newLeaf: IWorkspaceLayoutNode = { type: 'leaf', sessionId: newSessionId };
    const children = insertBefore ? [newLeaf, sourceLeaf] : [sourceLeaf, newLeaf];

    return this._registerWorkspace({ type: 'branch', direction, children, sizes: [50, 50] }, newSessionId);
  }

  private _mergeWorkspaces(source: IWorkspace, target: IWorkspace, side: DropSide): string {
    const sourceSessionIds = collectSessionIds(source.layout);

    // Dissolve the source workspace first (removes from tab order)
    this.dissolveWorkspace(source.id);

    // Add each source session into the target workspace
    let currentTarget = target;
    for (const sid of sourceSessionIds) {
      const targetSession = currentTarget.activeSessionId ?? collectSessionIds(currentTarget.layout)[0];
      if (targetSession) {
        this.mergeSessionIntoWorkspace(sid, currentTarget.id, targetSession, side);
      }
      // Update target reference after each merge
      currentTarget = this.getWorkspace(target.id) ?? currentTarget;
    }

    return target.id;
  }

  private _removeSessionFromLayout(workspaceId: string, sessionId: string): void {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return;

    const newLayout = removeSessionFromNode(ws.layout, sessionId);
    if (!newLayout) {
      // Workspace is empty, dissolve
      this.dissolveWorkspace(workspaceId);
      return;
    }

    const remainingIds = collectSessionIds(newLayout);
    if (remainingIds.length <= 1) {
      // Auto-degrade
      this.dissolveWorkspace(workspaceId);
      return;
    }

    const activeSessionId = ws.activeSessionId === sessionId
      ? remainingIds[0] ?? null
      : ws.activeSessionId;

    this._workspaces$.next(
      this._workspaces$.value.map((w) =>
        w.id === workspaceId ? { ...w, layout: newLayout, activeSessionId } : w
      )
    );

    // Remove from tab order (it's now a standalone session)
    const order = this._tabItemOrder$.value;
    if (!order.includes(sessionId)) {
      this._tabItemOrder$.next([...order, sessionId]);
    }
  }

  updatePanelSizes(workspaceId: string, branchPath: number[], sizes: number[]): void {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return;

    const newLayout = updateSizesAtPath(ws.layout, branchPath, sizes);
    this._workspaces$.next(
      this._workspaces$.value.map((w) => w.id === workspaceId ? { ...w, layout: newLayout } : w)
    );
  }

  setActiveSessionInWorkspace(workspaceId: string, sessionId: string): void {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return;

    if (this._activeTabItemId$.value !== workspaceId) {
      this._activeTabItemId$.next(workspaceId);
    }

    if (ws.activeSessionId === sessionId) {
      this._terminalUIService.setActiveSession(sessionId);
      return;
    }

    this._workspaces$.next(
      this._workspaces$.value.map((w) => w.id === workspaceId ? { ...w, activeSessionId: sessionId } : w)
    );
    this._terminalUIService.setActiveSession(sessionId);
  }

  removeSessionFromWorkspace(workspaceId: string, sessionId: string): void {
    const ws = this.getWorkspace(workspaceId);
    if (ws) {
      if (this._activeTabItemId$.value !== workspaceId) {
        this._activeTabItemId$.next(workspaceId);
      }

      if (ws.activeSessionId === sessionId) {
        const fallbackSessionId = collectSessionIds(ws.layout).find((id) => id !== sessionId) ?? null;
        if (fallbackSessionId) {
          this._terminalUIService.setActiveSession(fallbackSessionId);
        }
      }
    }

    // Remove from TerminalUIService; _syncWithSessions will update workspace layout and tab order.
    this._terminalUIService.removeSession(sessionId);
  }

  moveSessionInWorkspace(workspaceId: string, sessionId: string, targetSessionId: string, side: DropSide): void {
    if (sessionId === targetSessionId) return;
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return;

    if (side === 'center') {
      const newLayout = swapTwoSessions(ws.layout, sessionId, targetSessionId);
      this._workspaces$.next(
        this._workspaces$.value.map((w) => w.id === workspaceId ? { ...w, layout: newLayout } : w)
      );
      return;
    }

    // Remove the session from its current position
    const layoutAfterRemove = removeSessionFromNode(ws.layout, sessionId);
    if (!layoutAfterRemove) return;

    // Insert at the new position
    const newLayout = insertSessionIntoNode(layoutAfterRemove, targetSessionId, sessionId, side);

    this._workspaces$.next(
      this._workspaces$.value.map((w) => w.id === workspaceId ? { ...w, layout: newLayout } : w)
    );
  }

  toggleMagnify(workspaceId: string, sessionId: string): void {
    const current = this._magnifyState$.value;
    if (current && current.workspaceId === workspaceId && current.sessionId === sessionId) {
      this._magnifyState$.next(null);
    } else {
      this._magnifyState$.next({ workspaceId, sessionId });
    }
  }

  clearMagnify(): void {
    this._magnifyState$.next(null);
  }

  setPaneToTabDrag(state: IPaneToTabDragState | null): void {
    this._paneToTabDrag$.next(state);
  }

  extractSessionToTab(workspaceId: string, sessionId: string, targetTabId?: string, position?: 'before' | 'after'): void {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return;

    const allIds = collectSessionIds(ws.layout);
    if (!allIds.includes(sessionId)) return;

    const remainingIds = allIds.filter((id) => id !== sessionId);

    if (remainingIds.length <= 1) {
      // Workspace will dissolve — manually control tab order
      this._workspaces$.next(this._workspaces$.value.filter((w) => w.id !== workspaceId));

      const order = [...this._tabItemOrder$.value];
      const wsIndex = order.indexOf(workspaceId);

      // Remove workspace from order
      const newOrder = order.filter((id) => id !== workspaceId);

      // Insert remaining session at workspace's old position
      const remainingSessionId = remainingIds[0];
      if (remainingSessionId) {
        const insertPos = Math.min(wsIndex >= 0 ? wsIndex : newOrder.length, newOrder.length);
        newOrder.splice(insertPos, 0, remainingSessionId);
      }

      // Insert extracted session at the target position
      // If targetTabId was the dissolved workspace, use the remaining session as anchor
      const resolvedTargetId = targetTabId === workspaceId && remainingSessionId
        ? remainingSessionId
        : targetTabId;
      this._insertSessionIntoTabOrder(newOrder, sessionId, resolvedTargetId, position, remainingSessionId);

      this._tabItemOrder$.next(newOrder);

      // Clear magnify if workspace was dissolved
      if (this._magnifyState$.value?.workspaceId === workspaceId) {
        this._magnifyState$.next(null);
      }
    } else {
      // Workspace survives — remove session from layout
      const newLayout = removeSessionFromNode(ws.layout, sessionId);
      if (!newLayout) return;

      const activeSessionId = ws.activeSessionId === sessionId
        ? remainingIds[0] ?? null
        : ws.activeSessionId;

      this._workspaces$.next(
        this._workspaces$.value.map((w) =>
          w.id === workspaceId ? { ...w, layout: newLayout, activeSessionId } : w
        )
      );

      // Add session to tab order at the target position
      const order = [...this._tabItemOrder$.value];
      this._insertSessionIntoTabOrder(order, sessionId, targetTabId, position, workspaceId);
      this._tabItemOrder$.next(order);
    }

    // Set the extracted session as active
    this._activeTabItemId$.next(sessionId);
    this._terminalUIService.setActiveSession(sessionId);
  }

  private _insertSessionIntoTabOrder(
    order: string[],
    sessionId: string,
    targetTabId: string | undefined,
    position: 'before' | 'after' | undefined,
    fallbackAnchorId: string | undefined
  ): void {
    if (targetTabId && position) {
      const targetIndex = order.indexOf(targetTabId);
      if (targetIndex >= 0) {
        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        order.splice(insertIndex, 0, sessionId);
        return;
      }
    }

    if (fallbackAnchorId) {
      const anchorIndex = order.indexOf(fallbackAnchorId);
      if (anchorIndex >= 0) {
        order.splice(anchorIndex + 1, 0, sessionId);
        return;
      }
    }

    order.push(sessionId);
  }

  getWorkspaceForSession(sessionId: string): IWorkspace | undefined {
    return this._workspaces$.value.find((ws) => containsSession(ws.layout, sessionId));
  }

  isSessionInWorkspace(sessionId: string): boolean {
    return this._workspaces$.value.some((ws) => containsSession(ws.layout, sessionId));
  }

  getSessionCountInWorkspace(workspaceId: string): number {
    const ws = this.getWorkspace(workspaceId);
    if (!ws) return 0;
    return collectSessionIds(ws.layout).length;
  }

  restoreWorkspaces(workspaces: IWorkspace[], tabItemOrder: string[], activeTabItemId: string | null): void {
    this._workspaces$.next(workspaces);
    this._tabItemOrder$.next(tabItemOrder);
    if (activeTabItemId) {
      this._activeTabItemId$.next(activeTabItemId);
    }
  }

  getTabItemOrder(): string[] {
    return [...this._tabItemOrder$.value];
  }

  override dispose(): void {
    this._workspaces$.complete();
    this._tabItemOrder$.complete();
    this._activeTabItemId$.complete();
    this._magnifyState$.complete();
    this._paneToTabDrag$.complete();
    super.dispose();
  }
}
