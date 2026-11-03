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

import type { IACPSessionInfo, IACPSessionService } from '@termlnk/acp';
import type { AgentStatus, IAIAgentService } from '@termlnk/agent';
import type { ILifecycleService, ILogService } from '@termlnk/core';
import type { ConfigRepository } from '@termlnk/database';
import type { IKeepAwakeService } from '@termlnk/electron';
import { ELECTRON_PLUGIN_CONFIG_KEY } from '@termlnk/electron';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentKeepAwakeController } from '../controllers/agent-keep-awake.controller';

function makeSession(id: string, status: IACPSessionInfo['status']): IACPSessionInfo {
  return {
    id,
    providerId: 'p',
    providerTitle: 'P',
    cwd: '/tmp',
    status,
    createdAt: 0,
    updatedAt: 0,
  };
}

interface ITestBed {
  controller: AgentKeepAwakeController;
  agentStatus$: BehaviorSubject<AgentStatus>;
  acpSessions$: BehaviorSubject<IACPSessionInfo[]>;
  changed$: Subject<{ key: string; subKey?: string }>;
  setStored: (value: unknown) => void;
  acquire: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function createTestBed(initialSetting: { keepAwakeWhileAgentActive: boolean } | undefined): Promise<ITestBed> {
  const agentStatus$ = new BehaviorSubject<AgentStatus>('idle');
  const acpSessions$ = new BehaviorSubject<IACPSessionInfo[]>([]);
  const changed$ = new Subject<{ key: string; subKey?: string }>();
  let stored: unknown = initialSetting;

  const release = vi.fn();
  const acquire = vi.fn(() => ({ dispose: release }));

  const configRepository = {
    changed$,
    getField: vi.fn(async () => stored),
  } as unknown as ConfigRepository;
  const aiAgentService = { status$: agentStatus$.asObservable() } as unknown as IAIAgentService;
  const acpSessionService = { sessions$: acpSessions$.asObservable() } as unknown as IACPSessionService;
  const lifecycleService = { onStage: async () => {} } as unknown as ILifecycleService;
  const logService = { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() } as unknown as ILogService;
  const keepAwakeService = { acquire } as unknown as IKeepAwakeService;

  const controller = new AgentKeepAwakeController(
    configRepository,
    aiAgentService,
    acpSessionService,
    lifecycleService,
    logService,
    keepAwakeService
  );
  await flush();

  return {
    controller,
    agentStatus$,
    acpSessions$,
    changed$,
    setStored: (value) => {
      stored = value;
    },
    acquire,
    release,
  };
}

describe('AgentKeepAwakeController', () => {
  let bed: ITestBed;

  afterEach(() => {
    bed.controller.dispose();
  });

  describe('when the setting is enabled', () => {
    beforeEach(async () => {
      bed = await createTestBed({ keepAwakeWhileAgentActive: true });
    });

    it('does not hold while everything is idle', () => {
      expect(bed.acquire).not.toHaveBeenCalled();
    });

    it('holds while an ACP session is streaming and releases when it returns to ready', () => {
      bed.acpSessions$.next([makeSession('a', 'streaming')]);
      expect(bed.acquire).toHaveBeenCalledTimes(1);

      bed.acpSessions$.next([makeSession('a', 'ready')]);
      expect(bed.release).toHaveBeenCalledTimes(1);
    });

    it.each(['idle', 'connecting', 'ready', 'error', 'closed'] as const)(
      'does not hold for an ACP session in %s',
      (status) => {
        bed.acpSessions$.next([makeSession('a', status)]);
        expect(bed.acquire).not.toHaveBeenCalled();
      }
    );

    it('holds once when several ACP sessions stream and releases only after all stop', () => {
      bed.acpSessions$.next([makeSession('a', 'streaming'), makeSession('b', 'streaming')]);
      expect(bed.acquire).toHaveBeenCalledTimes(1);

      bed.acpSessions$.next([makeSession('a', 'ready'), makeSession('b', 'streaming')]);
      expect(bed.release).not.toHaveBeenCalled();

      bed.acpSessions$.next([makeSession('a', 'ready'), makeSession('b', 'ready')]);
      expect(bed.release).toHaveBeenCalledTimes(1);
    });

    it('holds while the internal agent is working', () => {
      bed.agentStatus$.next('tool_calling');
      expect(bed.acquire).toHaveBeenCalledTimes(1);

      bed.agentStatus$.next('idle');
      expect(bed.release).toHaveBeenCalledTimes(1);
    });

    it('keeps a single hold when internal and ACP sources overlap', () => {
      bed.agentStatus$.next('streaming');
      bed.acpSessions$.next([makeSession('a', 'streaming')]);
      expect(bed.acquire).toHaveBeenCalledTimes(1);

      bed.agentStatus$.next('idle');
      expect(bed.release).not.toHaveBeenCalled();

      bed.acpSessions$.next([]);
      expect(bed.release).toHaveBeenCalledTimes(1);
    });

    it('releases the hold on dispose', () => {
      bed.acpSessions$.next([makeSession('a', 'streaming')]);
      bed.controller.dispose();
      expect(bed.release).toHaveBeenCalledTimes(1);
    });

    it('releases the hold when the setting is turned off', async () => {
      bed.acpSessions$.next([makeSession('a', 'streaming')]);
      expect(bed.acquire).toHaveBeenCalledTimes(1);

      bed.setStored({ keepAwakeWhileAgentActive: false });
      bed.changed$.next({ key: ELECTRON_PLUGIN_CONFIG_KEY, subKey: 'appSettings' });
      await flush();

      expect(bed.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the setting is disabled', () => {
    it('never holds even while an ACP session streams', async () => {
      bed = await createTestBed({ keepAwakeWhileAgentActive: false });
      bed.acpSessions$.next([makeSession('a', 'streaming')]);
      expect(bed.acquire).not.toHaveBeenCalled();
    });
  });
});
