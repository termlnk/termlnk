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

import type { ICespEvent, IExternalAgentSession, IIslandSession, IPendingInteractionPayload, IPermissionDecision } from '@termlnk/island';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, ILogService } from '@termlnk/core';
import { AnimationState, CespEventCategory, computeIslandView, pickActiveSession, SessionPhase, toIslandSession } from '@termlnk/island';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '@termlnk/rpc-client';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, from, map, mergeMap, scan, share } from 'rxjs';
import { SPAM_THRESHOLD, SPAM_WINDOW_MS } from '../common/constants';

// ---------------------------------------------------------------------------
// CESP derivation
// ---------------------------------------------------------------------------

interface ICespDeriveState {
  readonly initialized: boolean;
  readonly sessionPhases: ReadonlyMap<string, SessionPhase>;
  readonly hadInteractions: boolean;
  readonly recentAcknowledgeTimes: readonly number[];
  readonly prevSpamTriggered: boolean;
  readonly events: readonly ICespEvent[];
}

const INITIAL_DERIVE_STATE: ICespDeriveState = {
  initialized: false,
  sessionPhases: new Map(),
  hadInteractions: false,
  recentAcknowledgeTimes: [],
  prevSpamTriggered: false,
  events: [],
};

/**
 * Pure reducer that projects session-phase transitions and pending
 * interactions into CESP events. Kept outside the class so the logic is
 * unit-testable without instantiating the service.
 */
function deriveCespEvents(
  prev: ICespDeriveState,
  sessions: IIslandSession[],
  interactions: IPendingInteractionPayload[]
): ICespDeriveState {
  const now = Date.now();
  const currentPhases = new Map<string, SessionPhase>();
  for (const s of sessions) {
    currentPhases.set(s.terminalSessionId, s.phase);
  }

  // First emission: capture initial state without emitting events so
  // cold-start doesn't synthesise spurious sounds.
  if (!prev.initialized) {
    return {
      initialized: true,
      sessionPhases: currentPhases,
      hadInteractions: interactions.length > 0,
      recentAcknowledgeTimes: [],
      prevSpamTriggered: false,
      events: [],
    };
  }

  const events: ICespEvent[] = [];
  const newAcknowledgeTimes: number[] = [];
  let inputRequiredFromPhase = false;

  for (const [sessionId, currentPhase] of currentPhases) {
    const prevPhase = prev.sessionPhases.get(sessionId);
    if (prevPhase === undefined) {
      if (currentPhase !== SessionPhase.Ended) {
        events.push({ category: CespEventCategory.SessionStart, sessionId, timestamp: now });
      }
      continue;
    }
    if (prevPhase === currentPhase) {
      continue;
    }

    // Waiting → Processing = user submitted a fresh prompt.
    if (
      (prevPhase === SessionPhase.WaitingForInput || prevPhase === SessionPhase.Idle)
      && currentPhase === SessionPhase.Processing
    ) {
      events.push({ category: CespEventCategory.TaskAcknowledge, sessionId, timestamp: now });
      newAcknowledgeTimes.push(now);
    }
    if (prevPhase === SessionPhase.Processing && currentPhase === SessionPhase.WaitingForInput) {
      events.push({ category: CespEventCategory.TaskComplete, sessionId, timestamp: now });
    }
    if (prevPhase !== SessionPhase.Error && currentPhase === SessionPhase.Error) {
      events.push({ category: CespEventCategory.TaskError, sessionId, timestamp: now });
    }
    if (prevPhase !== SessionPhase.WaitingForApproval && currentPhase === SessionPhase.WaitingForApproval) {
      inputRequiredFromPhase = true;
    }
    if (prevPhase !== SessionPhase.Compacting && currentPhase === SessionPhase.Compacting) {
      events.push({ category: CespEventCategory.ResourceLimit, sessionId, timestamp: now });
    }
    if (prevPhase !== SessionPhase.Ended && currentPhase === SessionPhase.Ended) {
      events.push({ category: CespEventCategory.SessionEnd, sessionId, timestamp: now });
    }
  }

  for (const [sessionId, prevPhase] of prev.sessionPhases) {
    if (!currentPhases.has(sessionId) && prevPhase !== SessionPhase.Ended) {
      events.push({ category: CespEventCategory.SessionEnd, sessionId, timestamp: now });
    }
  }

  // Emit `InputRequired` exactly once per transition, whether triggered by
  // a new pending interaction or a WaitingForApproval phase flip.
  const hasInteractions = interactions.length > 0;
  if (inputRequiredFromPhase || (hasInteractions && !prev.hadInteractions)) {
    const inputSessionId = interactions[0]?.terminalSessionId
      ?? sessions.find((s) => s.phase === SessionPhase.WaitingForApproval)?.terminalSessionId
      ?? 'unknown';
    events.push({ category: CespEventCategory.InputRequired, sessionId: inputSessionId, timestamp: now });
  }

  // Spam detection — "user pushed Enter too fast".
  const cutoff = now - SPAM_WINDOW_MS;
  const filteredAcknowledgeTimes = [
    ...prev.recentAcknowledgeTimes.filter((t) => t > cutoff),
    ...newAcknowledgeTimes,
  ];
  const isSpamming = filteredAcknowledgeTimes.length >= SPAM_THRESHOLD;
  if (isSpamming && !prev.prevSpamTriggered && newAcknowledgeTimes.length > 0) {
    const spamSessionId = events.find((e) => e.category === CespEventCategory.TaskAcknowledge)?.sessionId ?? 'unknown';
    events.push({ category: CespEventCategory.UserSpam, sessionId: spamSessionId, timestamp: now });
  }

  return {
    initialized: true,
    sessionPhases: currentPhases,
    hadInteractions: hasInteractions,
    recentAcknowledgeTimes: filteredAcknowledgeTimes,
    prevSpamTriggered: isSpamming,
    events,
  };
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/**
 * Renderer-side island state hub. Aggregates the tRPC streams from the
 * main process into the same view shape that
 * `@termlnk/island-core/IslandStateService` produces, and layers
 * renderer-only UI concerns (expand/collapse + CESP derivation) on top.
 */
export interface IIslandUIStateService {
  readonly sessions$: Observable<IIslandSession[]>;
  readonly pendingInteractions$: Observable<IPendingInteractionPayload[]>;
  readonly activeSession$: Observable<IIslandSession | null>;
  readonly animationState$: Observable<AnimationState>;
  readonly expanded$: Observable<boolean>;
  readonly cespEvent$: Observable<ICespEvent>;

  get expanded(): boolean;
  setExpanded(value: boolean): void;
  respondPermission(requestId: string, decision: IPermissionDecision): void;
}

export const IIslandUIStateService = createIdentifier<IIslandUIStateService>('island-ui.island-ui-state-service');

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

export class IslandUIStateService extends Disposable implements IIslandUIStateService {
  private readonly _rawSessions$ = new BehaviorSubject<IExternalAgentSession[]>([]);
  private readonly _pendingInteractions$ = new BehaviorSubject<IPendingInteractionPayload[]>([]);
  readonly pendingInteractions$: Observable<IPendingInteractionPayload[]> = this._pendingInteractions$.asObservable();

  readonly sessions$: Observable<IIslandSession[]>;
  readonly activeSession$: Observable<IIslandSession | null>;
  readonly animationState$: Observable<AnimationState>;

  private readonly _expanded$ = new BehaviorSubject<boolean>(false);
  readonly expanded$: Observable<boolean> = this._expanded$.asObservable();

  readonly cespEvent$: Observable<ICespEvent>;

  get expanded(): boolean {
    return this._expanded$.getValue();
  }

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    // Project raw sessions → IIslandSession using the same reducer the
    // main process runs, so divergence is structurally impossible.
    // `hasPendingQuestion` is sourced from `_pendingInteractions$` so the
    // session-level pet glyph (e.g. expanded list cards) flips to its
    // Question state independently of `phase`.
    this.sessions$ = combineLatest([this._rawSessions$, this._pendingInteractions$]).pipe(
      map(([raw, pending]) => {
        const questionSessionIds = new Set(
          pending.filter((p) => p.kind === 'question').map((p) => p.terminalSessionId)
        );
        return raw.map((s) =>
          toIslandSession(s, questionSessionIds.has(s.terminalSessionId))
        );
      })
    );

    this.activeSession$ = this.sessions$.pipe(
      map((sessions) => pickActiveSession(sessions)),
      distinctUntilChanged()
    );

    // Animation state:
    // - any classic permission request → NeedsYou (island auto-expands so
    //   the user can allow/deny)
    // - else any AskUserQuestion pending → Question (pet turns yellow +
    //   shows `?`; island does NOT auto-expand because there is no picker
    //   — the agent's CLI TUI handles the pick natively)
    // - else derive from the winning session phase.
    this.animationState$ = combineLatest([this._rawSessions$, this._pendingInteractions$]).pipe(
      map(([raw, pending]) => {
        if (pending.some((p) => p.kind === 'permission')) {
          return AnimationState.NeedsYou;
        }
        if (pending.some((p) => p.kind === 'question')) {
          return AnimationState.Question;
        }
        return computeIslandView(raw, pending).animationState;
      }),
      distinctUntilChanged()
    );

    this.cespEvent$ = combineLatest([this.sessions$, this._pendingInteractions$]).pipe(
      scan(
        (prev, [sessions, interactions]) => deriveCespEvents(prev, sessions, interactions),
        INITIAL_DERIVE_STATE
      ),
      filter((state) => state.events.length > 0),
      mergeMap((state) => from(state.events)),
      share()
    );

    this._initSubscriptions();
    this._initAutoExpand();
  }

  override dispose(): void {
    super.dispose();
    this._rawSessions$.complete();
    this._pendingInteractions$.complete();
    this._expanded$.complete();
  }

  setExpanded(value: boolean): void {
    this._expanded$.next(value);
  }

  respondPermission(requestId: string, decision: IPermissionDecision): void {
    const client = this._rpcClientService.getClient();
    void (client as any).agentMonitor.respondPermission.mutate({ requestId, decision });
  }

  private _initSubscriptions(): void {
    const client = this._rpcClientService.getClient();

    const rawSessions$ = trpcSubscriptionToObservable<IExternalAgentSession[]>(
      (opts) => (client as any).agentMonitor.sessions$.subscribe(undefined, opts)
    );
    this.disposeWithMe(
      rawSessions$.subscribe({
        next: (data) => this._rawSessions$.next(data),
        error: (err) => this._logService.error('[IslandUIStateService]', 'sessions$ error:', err),
      })
    );

    const rawInteractions$ = trpcSubscriptionToObservable<IPendingInteractionPayload[]>(
      (opts) => (client as any).agentMonitor.pendingInteractions$.subscribe(undefined, opts)
    );
    this.disposeWithMe(
      rawInteractions$.subscribe({
        next: (data) => this._pendingInteractions$.next(data),
        error: (err) => this._logService.error('[IslandUIStateService]', 'pendingInteractions$ error:', err),
      })
    );
  }

  /**
   * Auto-expand while a classic permission request is pending; collapse
   * back once the user has resolved (or the 120 s server-side timeout
   * fires).
   *
   * AskUserQuestion pendings do NOT trigger auto-expand — the island only
   * shows the pet's Question state because each agent's CLI TUI renders
   * its own picker natively.
   */
  private _initAutoExpand(): void {
    let hadPermission = false;
    this.disposeWithMe(
      this._pendingInteractions$.pipe(
        map((interactions) => interactions.some((p) => p.kind === 'permission')),
        distinctUntilChanged()
      ).subscribe((hasPermission) => {
        if (hasPermission) {
          this._expanded$.next(true);
        } else if (hadPermission) {
          this._expanded$.next(false);
        }
        hadPermission = hasPermission;
      })
    );
  }
}
