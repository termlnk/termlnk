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

import type { IPendingInteractionPayload } from '@termlnk/agent';
import type { AnimationState, IIslandSession } from './island';

/**
 * Unified island state computed from agent monitor data.
 *
 * Both the main process (`@termlnk/island-core`) and the renderer
 * (`@termlnk/island-ui`) converge on this shape via the same pure
 * `computeIslandView` reducer.
 */
export interface IIslandState {
  /** All active island sessions */
  readonly sessions: IIslandSession[];

  /**
   * Pending blocking interactions — approvals (`kind: 'permission'`) and
   * AskUserQuestion pickers (`kind: 'question'`). Rendered as a single list
   * so CESP `InputRequired` fires once regardless of picker variant.
   */
  readonly pendingInteractions: IPendingInteractionPayload[];

  /** The highest-priority session to display */
  readonly activeSession: IIslandSession | null;

  /** Overall animation state (derived from activeSession) */
  readonly animationState: AnimationState;
}
