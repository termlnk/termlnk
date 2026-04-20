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
import type { IIslandSession } from '../models/island';
import type { IIslandState } from '../models/island-state';
import { animationPriority, AnimationState, phaseToAnimationState, statusToPhase } from '../models/island';

/**
 * Pure reducer that projects raw monitor sessions + pending interactions
 * into the island view model. Used by both processes (main + renderer) so
 * they stay observably consistent without runtime coupling.
 */
export function computeIslandView(
  rawSessions: readonly IExternalAgentSession[],
  pendingInteractions: readonly IPendingInteractionPayload[]
): IIslandState {
  const sessions: IIslandSession[] = rawSessions.map(toIslandSession);
  const activeSession = pickActiveSession(sessions);
  const animationState = activeSession
    ? phaseToAnimationState(activeSession.phase)
    : AnimationState.Idle;

  return {
    sessions,
    pendingInteractions: [...pendingInteractions],
    activeSession,
    animationState,
  };
}

/**
 * Project a monitor-side `IExternalAgentSession` onto the island-facing
 * `IIslandSession`. Only static presentational fields survive; everything
 * that needs live mutation (lastEventAt, status, etc.) is already
 * immutable at this boundary.
 */
export function toIslandSession(s: IExternalAgentSession): IIslandSession {
  return {
    terminalSessionId: s.terminalSessionId,
    agent: s.agent,
    source: s.source,
    phase: statusToPhase(s.status),
    lastEventAt: s.lastEventAt,
    startedAt: s.startedAt,
    cwd: s.cwd,
    lastToolName: s.lastToolName,
    lastToolDescription: s.lastToolDescription,
    lastToolDetail: s.lastToolDetail,
    lastPrompt: s.lastPrompt,
    title: s.title,
    project: s.project,
    todos: s.todos,
  };
}

/**
 * Pick which session drives the island compact/collapsed visuals. Higher
 * animation priority wins; ties break on most-recently-active.
 */
export function pickActiveSession(sessions: readonly IIslandSession[]): IIslandSession | null {
  if (sessions.length === 0) {
    return null;
  }
  return sessions.reduce((best, s) => {
    const bestPriority = animationPriority(phaseToAnimationState(best.phase));
    const sPriority = animationPriority(phaseToAnimationState(s.phase));
    if (sPriority > bestPriority) {
      return s;
    }
    if (sPriority === bestPriority && s.lastEventAt > best.lastEventAt) {
      return s;
    }
    return best;
  });
}
