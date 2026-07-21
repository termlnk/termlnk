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

import type { ILogService } from '@termlnk/core';
import { describe, expect, it } from 'vitest';
import { TerminalUIService } from '../../terminal/terminal-ui.service';
import { WorkspaceService } from '../workspace.service';

function createTestBed() {
  const terminalUIService = new TerminalUIService();
  const logService: ILogService = {
    debug: () => {},
    log: () => {},
    warn: () => {},
    error: () => {},
    deprecate: () => {},
    setLogLevel: () => {},
  };
  const workspaceService = new WorkspaceService(terminalUIService, logService);
  return { terminalUIService, workspaceService };
}

function addSessions(terminalUIService: TerminalUIService, ...ids: string[]): void {
  for (const id of ids) {
    terminalUIService.addSession({ id, type: 'local', hostId: 'local', hostName: id });
  }
}

describe('workspaceService.renameWorkspace', () => {
  it('renames the workspace', () => {
    const { terminalUIService, workspaceService } = createTestBed();
    addSessions(terminalUIService, 's1', 's2');
    const wsId = workspaceService.createWorkspace(['s1', 's2']);

    workspaceService.renameWorkspace(wsId, 'Backend');

    expect(workspaceService.getWorkspace(wsId)?.name).toBe('Backend');
    workspaceService.dispose();
  });

  it('ignores blank names', () => {
    const { terminalUIService, workspaceService } = createTestBed();
    addSessions(terminalUIService, 's1', 's2');
    const wsId = workspaceService.createWorkspace(['s1', 's2']);

    workspaceService.renameWorkspace(wsId, '   ');
    expect(workspaceService.getWorkspace(wsId)?.name).toBe('Workspace');

    workspaceService.renameWorkspace(wsId, '');
    expect(workspaceService.getWorkspace(wsId)?.name).toBe('Workspace');
    workspaceService.dispose();
  });
});

describe('workspaceService.setWorkspaceIcon', () => {
  it('sets and clears the icon', () => {
    const { terminalUIService, workspaceService } = createTestBed();
    addSessions(terminalUIService, 's1', 's2');
    const wsId = workspaceService.createWorkspace(['s1', 's2']);

    workspaceService.setWorkspaceIcon(wsId, { emoji: '🚀', background: '#BDE3FF' });
    expect(workspaceService.getWorkspace(wsId)?.icon).toEqual({ emoji: '🚀', background: '#BDE3FF' });

    workspaceService.setWorkspaceIcon(wsId, null);
    expect(workspaceService.getWorkspace(wsId)?.icon).toBeUndefined();
    workspaceService.dispose();
  });
});

describe('workspaceService.setWorkspacePinned', () => {
  it('moves a freshly pinned tab after the last pinned tab', () => {
    const { terminalUIService, workspaceService } = createTestBed();
    addSessions(terminalUIService, 's1', 's2', 's3', 's4', 's5');
    const wsA = workspaceService.createWorkspace(['s1', 's2']);
    const wsB = workspaceService.createWorkspace(['s3', 's4']);
    expect(workspaceService.getTabItemOrder()).toEqual([wsA, wsB, 's5']);

    workspaceService.setWorkspacePinned(wsB, true);
    expect(workspaceService.getTabItemOrder()).toEqual([wsB, wsA, 's5']);

    workspaceService.setWorkspacePinned(wsA, true);
    expect(workspaceService.getTabItemOrder()).toEqual([wsB, wsA, 's5']);
    workspaceService.dispose();
  });

  it('keeps the tab position when unpinning', () => {
    const { terminalUIService, workspaceService } = createTestBed();
    addSessions(terminalUIService, 's1', 's2', 's3');
    const wsA = workspaceService.createWorkspace(['s1', 's2']);

    workspaceService.setWorkspacePinned(wsA, true);
    expect(workspaceService.getTabItemOrder()).toEqual([wsA, 's3']);

    workspaceService.setWorkspacePinned(wsA, false);
    expect(workspaceService.getTabItemOrder()).toEqual([wsA, 's3']);
    expect(workspaceService.isTabItemPinned(wsA)).toBe(false);
    workspaceService.dispose();
  });
});

describe('workspaceService.moveTabItem pinned clamping', () => {
  it('keeps regular tabs out of the pinned segment', () => {
    const { terminalUIService, workspaceService } = createTestBed();
    addSessions(terminalUIService, 's1', 's2', 's3', 's4');
    const wsA = workspaceService.createWorkspace(['s1', 's2']);
    workspaceService.setWorkspacePinned(wsA, true);
    expect(workspaceService.getTabItemOrder()).toEqual([wsA, 's3', 's4']);

    workspaceService.moveTabItem('s3', wsA, 'before');

    const order = workspaceService.getTabItemOrder();
    expect(order).toEqual([wsA, 's3', 's4']);
    expect(order.indexOf(wsA)).toBeLessThan(order.indexOf('s3'));
    workspaceService.dispose();
  });

  it('keeps pinned tabs inside the pinned segment', () => {
    const { terminalUIService, workspaceService } = createTestBed();
    addSessions(terminalUIService, 's1', 's2', 's3', 's4', 's5', 's6');
    const wsA = workspaceService.createWorkspace(['s1', 's2']);
    const wsB = workspaceService.createWorkspace(['s3', 's4']);
    workspaceService.setWorkspacePinned(wsA, true);
    workspaceService.setWorkspacePinned(wsB, true);
    expect(workspaceService.getTabItemOrder()).toEqual([wsA, wsB, 's5', 's6']);

    workspaceService.moveTabItem(wsA, 's6', 'after');

    const order = workspaceService.getTabItemOrder();
    expect(order.indexOf(wsA)).toBeLessThan(order.indexOf('s5'));
    expect(order.indexOf(wsB)).toBeLessThan(order.indexOf('s5'));
    expect([...order.slice(0, 2)].sort()).toEqual([wsA, wsB].sort());
    workspaceService.dispose();
  });
});

describe('workspaceService persistence roundtrip', () => {
  it('restores name/icon/pinned through the persisted workspace shape', () => {
    const first = createTestBed();
    addSessions(first.terminalUIService, 's1', 's2');
    const wsId = first.workspaceService.createWorkspace(['s1', 's2']);
    first.workspaceService.renameWorkspace(wsId, 'Infra');
    first.workspaceService.setWorkspaceIcon(wsId, { emoji: '🛠️', background: '#FFE9A8' });
    first.workspaceService.setWorkspacePinned(wsId, true);

    // Mirror TerminalPersistenceService.saveState()'s workspace mapping.
    const persisted = first.workspaceService.getAllWorkspaces().map((ws) => ({
      id: ws.id,
      name: ws.name,
      layout: ws.layout,
      activeSessionId: ws.activeSessionId,
      icon: ws.icon,
      pinned: ws.pinned,
    }));
    const tabItemOrder = first.workspaceService.getTabItemOrder();
    const activeTabItemId = first.workspaceService.getActiveTabItemId();

    const second = createTestBed();
    addSessions(second.terminalUIService, 's1', 's2');
    second.workspaceService.restoreWorkspaces(persisted, tabItemOrder, activeTabItemId);

    const restored = second.workspaceService.getWorkspace(wsId);
    expect(restored?.name).toBe('Infra');
    expect(restored?.icon).toEqual({ emoji: '🛠️', background: '#FFE9A8' });
    expect(restored?.pinned).toBe(true);
    expect(second.workspaceService.isTabItemPinned(wsId)).toBe(true);

    first.workspaceService.dispose();
    second.workspaceService.dispose();
  });
});
