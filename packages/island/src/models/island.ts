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

import type { AgentSessionSource, ExternalAgentType, IAgentTodo } from '@termlnk/agent';

/**
 * Session phases for the Dynamic Island display.
 * Maps from agent session status to a UI-facing phase.
 */
export enum SessionPhase {
  Idle = 'idle',
  Processing = 'processing',
  WaitingForInput = 'waitingForInput',
  WaitingForApproval = 'waitingForApproval',
  Compacting = 'compacting',
  Ended = 'ended',
  Error = 'error',
}

/**
 * Visual animation states for the Dynamic Island.
 * Derived from SessionPhase, drives color/animation/icon selection.
 */
export enum AnimationState {
  Idle = 'idle',
  Working = 'working',
  NeedsYou = 'needsYou',
  Thinking = 'thinking',
  Error = 'error',
  Done = 'done',
}

/**
 * An island-facing view of an external agent session.
 */
export interface IIslandSession {
  readonly terminalSessionId: string;
  readonly agent: ExternalAgentType;
  /**
   * Whether the session originated from a Termlnk PTY or from a terminal
   * outside Termlnk (discovered via `~/.config/termlnk/runtime.json`). Drives the
   * `External` marker shown next to the session in the island UI.
   */
  readonly source: AgentSessionSource;
  readonly phase: SessionPhase;
  readonly lastEventAt: number;
  readonly startedAt: number;
  readonly cwd?: string;
  /** Most recent tool activity of the turn. See `IExternalAgentSession`. */
  readonly lastToolName?: string;
  readonly lastToolDescription?: string;
  readonly lastToolDetail?: string;
  readonly lastPrompt?: string;
  readonly title?: string;
  /** Project identifier (cwd basename) used as the title prefix. */
  readonly project?: string;
  /**
   * Current task plan projected from the agent's todo-list tool calls.
   * Rendered as the task section of the session card when non-empty.
   */
  readonly todos?: readonly IAgentTodo[];
}

/**
 * Map a SessionPhase to its AnimationState.
 */
export function phaseToAnimationState(phase: SessionPhase): AnimationState {
  switch (phase) {
    case SessionPhase.Idle:
      return AnimationState.Idle;
    case SessionPhase.Processing:
      return AnimationState.Working;
    case SessionPhase.WaitingForInput:
      return AnimationState.Done;
    case SessionPhase.WaitingForApproval:
      return AnimationState.NeedsYou;
    case SessionPhase.Compacting:
      return AnimationState.Thinking;
    case SessionPhase.Ended:
      return AnimationState.Idle;
    case SessionPhase.Error:
      return AnimationState.Error;
    default:
      return AnimationState.Idle;
  }
}

/**
 * Map an AgentSessionStatus string to the corresponding SessionPhase.
 */
export function statusToPhase(status: string): SessionPhase {
  switch (status) {
    case 'running':
      return SessionPhase.Processing;
    case 'idle':
      return SessionPhase.Idle;
    case 'needs-input':
      return SessionPhase.WaitingForInput;
    case 'waiting-approval':
      return SessionPhase.WaitingForApproval;
    case 'compacting':
      return SessionPhase.Compacting;
    case 'stopped':
      return SessionPhase.Ended;
    default:
      return SessionPhase.Idle;
  }
}

/**
 * Priority for selecting which session to show (higher = more urgent).
 */
export function animationPriority(state: AnimationState): number {
  switch (state) {
    case AnimationState.Idle:
      return 0;
    case AnimationState.Done:
      return 1;
    case AnimationState.Thinking:
      return 2;
    case AnimationState.Working:
      return 3;
    case AnimationState.Error:
      return 4;
    case AnimationState.NeedsYou:
      return 5;
  }
}
