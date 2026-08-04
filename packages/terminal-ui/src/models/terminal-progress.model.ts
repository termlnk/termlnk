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

/**
 * ConEmu OSC 9;4 progress states, mirroring `@xterm/addon-progress`.
 *
 * `INDETERMINATE` carries no percentage by protocol — any value sent with it is
 * to be ignored, so it can only be rendered as motion, never as a fill level.
 */
export const XTERM_PROGRESS_STATE = {
  NONE: 0,
  RUNNING: 1,
  ERROR: 2,
  INDETERMINATE: 3,
  PAUSED: 4,
} as const;

export type XtermProgressStateValue = (typeof XTERM_PROGRESS_STATE)[keyof typeof XTERM_PROGRESS_STATE];

export interface IXtermProgressState {
  state: XtermProgressStateValue;
  value: number;
}

export const DEFAULT_PROGRESS_STATE: IXtermProgressState = { state: XTERM_PROGRESS_STATE.NONE, value: 0 };

/** States that carry a meaningful percentage and so warrant the detailed overlay. */
export function hasMeasurableProgress(state: XtermProgressStateValue): boolean {
  return state === XTERM_PROGRESS_STATE.RUNNING
    || state === XTERM_PROGRESS_STATE.ERROR
    || state === XTERM_PROGRESS_STATE.PAUSED;
}

export function isSameProgress(a: IXtermProgressState, b: IXtermProgressState): boolean {
  return a.state === b.state && a.value === b.value;
}
