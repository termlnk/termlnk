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

import type { ACPSessionStatus } from '@termlnk/acp';
import type { AgentStatus } from '@termlnk/agent';
import type { IDisposable } from '@termlnk/core';
import type { IAppSettings } from '@termlnk/electron';
import { IACPSessionService } from '@termlnk/acp';
import { IAIAgentService } from '@termlnk/agent';
import { ILifecycleService, ILogService, Inject, LifecycleStages, RxDisposable } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { ELECTRON_PLUGIN_CONFIG_KEY, IKeepAwakeService, normalizeAppSettings } from '@termlnk/electron';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, map, takeUntil } from 'rxjs';

const INTERNAL_ACTIVE_STATUSES: ReadonlySet<AgentStatus> = new Set([
  'thinking',
  'tool_calling',
  'streaming',
  'compacting',
]);

// Only `streaming` means work is in flight: ACPConnection sets it while a prompt
// request is pending (including turns blocked on a permission request) and
// returns to `ready` when the turn ends. `connecting` is a short handshake and
// `idle` / `ready` / `error` / `closed` do no work, so none of them hold the
// system awake.
const ACP_ACTIVE_STATUSES: ReadonlySet<ACPSessionStatus> = new Set([
  'streaming',
]);

const ACQUIRE_REASON = 'agent-active';

export class AgentKeepAwakeController extends RxDisposable {
  private readonly _enabled$ = new BehaviorSubject<boolean>(false);
  private _currentHandle: IDisposable | null = null;

  constructor(
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @IAIAgentService private readonly _aiAgentService: IAIAgentService,
    @IACPSessionService private readonly _acpSessionService: IACPSessionService,
    @ILifecycleService private readonly _lifecycleService: ILifecycleService,
    @ILogService private readonly _logService: ILogService,
    @IKeepAwakeService private readonly _keepAwakeService: IKeepAwakeService
  ) {
    super();

    this._init();
  }

  override dispose(): void {
    if (this._currentHandle) {
      this._currentHandle.dispose();
      this._currentHandle = null;
    }
    this._enabled$.complete();
    super.dispose();
  }

  private _init(): void {
    void this._onReady().catch((err: any) => {
      this._logService.error(`[AgentKeepAwakeController] Failed to initialize: ${err.message}`);
    });
  }

  private async _onReady(): Promise<void> {
    await this._lifecycleService.onStage(LifecycleStages.Ready);
    await this._loadSetting();
    this._listenSettingChanges();
    this._reactToCondition();
  }

  private async _loadSetting(): Promise<void> {
    const stored = await this._configRepository.getField<IAppSettings>(
      ELECTRON_PLUGIN_CONFIG_KEY,
      'appSettings'
    );
    this._enabled$.next(normalizeAppSettings(stored).keepAwakeWhileAgentActive);
  }

  private _listenSettingChanges(): void {
    this._configRepository.changed$.pipe(
      filter((event) =>
        event.key === ELECTRON_PLUGIN_CONFIG_KEY
        && (event.subKey === 'appSettings' || event.subKey === undefined)
      ),
      takeUntil(this.dispose$)
    ).subscribe(() => {
      void this._loadSetting().catch((err: any) => {
        this._logService.error(`[AgentKeepAwakeController] Failed to reload settings: ${err.message}`);
      });
    });
  }

  private _reactToCondition(): void {
    const internalActive$ = this._aiAgentService.status$.pipe(
      map((status) => INTERNAL_ACTIVE_STATUSES.has(status)),
      distinctUntilChanged()
    );

    const acpActive$ = this._acpSessionService.sessions$.pipe(
      map((sessions) => sessions.some((session) => ACP_ACTIVE_STATUSES.has(session.status))),
      distinctUntilChanged()
    );

    const agentActive$ = combineLatest([internalActive$, acpActive$]).pipe(
      map(([internal, acp]) => internal || acp),
      distinctUntilChanged()
    );

    combineLatest([this._enabled$, agentActive$]).pipe(
      map(([enabled, active]) => enabled && active),
      distinctUntilChanged(),
      takeUntil(this.dispose$)
    ).subscribe((shouldHold) => {
      this._applyHold(shouldHold);
    });
  }

  private _applyHold(shouldHold: boolean): void {
    if (shouldHold && !this._currentHandle) {
      this._currentHandle = this._keepAwakeService.acquire(ACQUIRE_REASON);
      return;
    }
    if (!shouldHold && this._currentHandle) {
      this._currentHandle.dispose();
      this._currentHandle = null;
    }
  }
}
