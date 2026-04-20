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

import type { IAgentHookEvent, IAgentHookEventMeta, IExternalAgentSession } from '@termlnk/agent';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentMonitorService } from './agent-monitor.service';

const noopLog = {
  debug: () => {},
  log: () => {},
  warn: () => {},
  error: () => {},
  deprecate: () => {},
  setLogLevel: () => {},
};

const noopNotify = {
  notifications$: new Subject(),
  unreadCount$: new Subject(),
  isPanelOpen$: new Subject(),
  notificationEvent$: new Subject(),
  notify: () => ({ id: 'n' } as any),
  markAsRead: () => {},
  markAllAsRead: () => {},
  markGroupAsRead: () => {},
  remove: () => {},
  clearAll: () => {},
  clearRead: () => {},
  getNotifications: () => [],
  getNotification: () => undefined,
  getStats: () => ({ total: 0, unread: 0, bySource: {} as any, byType: {} as any }),
  getUnreadCountForGroup: () => 0,
  openPanel: () => {},
  closePanel: () => {},
  togglePanel: () => {},
};

function makeConfigStub(): any {
  return {
    changed$: new Subject(),
    getField: async () => null,
  };
}

function makeMeta(overrides: Partial<IAgentHookEventMeta> = {}): IAgentHookEventMeta {
  return {
    ppid: 1000,
    tty: '/dev/ttys001',
    cwd: '/home/user',
    termProgram: 'iTerm.app',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<IAgentHookEvent> & Pick<IAgentHookEvent, 'event'>): IAgentHookEvent {
  return {
    sessionId: 'external-abc',
    agent: 'claude-code',
    timestamp: new Date().toISOString(),
    meta: makeMeta(),
    ...overrides,
  } as IAgentHookEvent;
}

describe('AgentMonitorService canonical key routing', () => {
  let service: AgentMonitorService;

  beforeEach(() => {
    service = new AgentMonitorService(noopLog as any, noopNotify as any, makeConfigStub());
  });

  afterEach(() => {
    service.dispose();
  });

  it('TC1: external Claude switching cwd does not create ghost sessions', () => {
    // Simulate an external Claude (no TERMLNK_SESSION_ID). Transport-layer
    // sessionId was historically unstable across cwd changes (pre-fix), so
    // assume the helper upgraded: same sessionId, agentSessionId stable.
    const agentId = 'claude-sess-1';
    const transportId = 'external-stable';

    service.handleHookEvent(makeEvent({
      event: 'session-start',
      sessionId: transportId,
      agentSessionId: agentId,
      meta: makeMeta({ cwd: '/project/a' }),
      payload: { cwd: '/project/a' },
    }));

    service.handleHookEvent(makeEvent({
      event: 'pre-tool-use',
      sessionId: transportId,
      agentSessionId: agentId,
      meta: makeMeta({ cwd: '/project/b' }),
      payload: { tool_name: 'Bash', tool_input: { command: 'cd /project/b' }, cwd: '/project/b' },
    }));

    service.handleHookEvent(makeEvent({
      event: 'pre-tool-use',
      sessionId: transportId,
      agentSessionId: agentId,
      meta: makeMeta({ cwd: '/project/c' }),
      payload: { tool_name: 'Read', tool_input: { file_path: '/project/c/foo.ts' }, cwd: '/project/c' },
    }));

    service.handleHookEvent(makeEvent({
      event: 'stop',
      sessionId: transportId,
      agentSessionId: agentId,
    }));

    const sessions = service.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].agentSessionId).toBe(agentId);
  });

  it('TC2: identity upgrade merges early sessionId-only entry into agentSessionId key', () => {
    const transportId = 'pty-42';
    const agentId = 'claude-sess-upgrade';

    // First event lacks agentSessionId (e.g. session-start fired before
    // agent stamped its id on later events). Entry indexed under sessionId.
    service.handleHookEvent(makeEvent({
      event: 'session-start',
      sessionId: transportId,
      agentSessionId: undefined,
      payload: { cwd: '/p' },
    }));
    expect(service.getSession(transportId)).toBeDefined();

    // Subsequent event carries the agent-native id → should migrate the
    // existing entry to `agentId` key, not create a second one.
    service.handleHookEvent(makeEvent({
      event: 'post-tool-use',
      sessionId: transportId,
      agentSessionId: agentId,
      payload: { tool_name: 'Read', tool_input: { file_path: '/x' } },
    }));

    const sessions = service.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].agentSessionId).toBe(agentId);
    expect(sessions[0].terminalSessionId).toBe(transportId);
    // Looking up by the original transport id must still work (via alias).
    expect(service.getSession(transportId)?.agentSessionId).toBe(agentId);
  });

  it('TC3: OpenCode permission without agentSessionId still routes to existing session', () => {
    const transportId = 'external-opencode';
    const agentId = 'op-sess-1';

    service.handleHookEvent(makeEvent({
      event: 'session-start',
      agent: 'opencode',
      sessionId: transportId,
      agentSessionId: agentId,
      payload: { cwd: '/work' },
    }));

    // OpenCode's permission.ask forwards no session_id; the helper reports
    // only sessionId. Without alias resolution this would spawn a ghost.
    service.handleHookEvent(makeEvent({
      event: 'permission-request',
      agent: 'opencode',
      sessionId: transportId,
      agentSessionId: undefined,
      payload: { tool_name: 'write', requestId: 'req-1' },
    }));

    const sessions = service.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe('waiting-approval');
    expect(sessions[0].agentSessionId).toBe(agentId);
  });

  it('TC4: session-end purges both canonical entry and its alias', () => {
    const transportId = 'external-gc';
    const agentId = 'claude-sess-gc';

    service.handleHookEvent(makeEvent({
      event: 'session-start',
      sessionId: transportId,
      agentSessionId: agentId,
    }));
    expect(service.getSession(transportId)).toBeDefined();

    service.handleHookEvent(makeEvent({
      event: 'session-end',
      sessionId: transportId,
      agentSessionId: agentId,
    }));

    expect(service.getSession(transportId)).toBeUndefined();
    expect(service.getSessions()).toHaveLength(0);

    // A *new* event carrying only the old transport id must now create a
    // fresh entry keyed by sessionId (alias was purged) — not resurrect the
    // old one via a stale alias pointing to the deleted canonical key.
    service.handleHookEvent(makeEvent({
      event: 'pre-tool-use',
      sessionId: transportId,
      agentSessionId: undefined,
      payload: { tool_name: 'Read' },
    }));
    const revived = service.getSession(transportId);
    expect(revived).toBeDefined();
    // Since no agentSessionId was carried, the entry is keyed by transport id.
    expect((revived as IExternalAgentSession).agentSessionId).toBeUndefined();
  });
});
