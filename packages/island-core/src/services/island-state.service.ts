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

import type { IExternalAgentSession, IPendingInteractionPayload } from '@termlnk/agent';
import type { IIslandState, IIslandStateService } from '@termlnk/island';
import type { Observable } from 'rxjs';
import { IAgentHookServerService, IAgentMonitorService } from '@termlnk/agent';
import { Disposable, toDisposable } from '@termlnk/core';
import { AnimationState, computeIslandView } from '@termlnk/island';
import { BehaviorSubject, combineLatest } from 'rxjs';

const DEFAULT_ISLAND_STATE: IIslandState = {
  sessions: [],
  pendingInteractions: [],
  activeSession: null,
  animationState: AnimationState.Idle,
};

/**
 * Main-process island state service. Consumed by
 * `DynamicIslandController` to decide when to show/hide the island window
 * and to dispatch global permission keyboard shortcuts. The renderer has
 * its own `IIslandUIStateService` that computes the same view shape so
 * both layers stay decoupled and the compute stays pure via
 * {@link computeIslandView}.
 */
export class IslandStateService extends Disposable implements IIslandStateService {
  private readonly _state$ = new BehaviorSubject<IIslandState>(DEFAULT_ISLAND_STATE);
  readonly state$: Observable<IIslandState> = this._state$.asObservable();

  constructor(
    @IAgentMonitorService private readonly _agentMonitorService: IAgentMonitorService,
    @IAgentHookServerService private readonly _hookServerService: IAgentHookServerService
  ) {
    super();
    this._initSubscriptions();
    this.disposeWithMe(toDisposable(() => {
      this._state$.complete();
    }));
  }

  private _initSubscriptions(): void {
    this.disposeWithMe(
      combineLatest([
        this._agentMonitorService.sessions$,
        this._hookServerService.pendingInteractions$,
      ]).subscribe(([rawSessions, interactions]) => {
        this._state$.next(this._computeState(rawSessions, interactions));
      })
    );
  }

  private _computeState(
    rawSessions: IExternalAgentSession[],
    pendingInteractions: IPendingInteractionPayload[]
  ): IIslandState {
    return computeIslandView(rawSessions, pendingInteractions);
  }
}
