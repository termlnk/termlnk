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

import type { Observable } from 'rxjs';
import type { ITerminalSuggestConfig, ITerminalSuggestion, ITerminalSuggestionPhaseEvent } from '../models/terminal-suggest';
import { createIdentifier } from '@termlnk/core';

/**
 * Coordinates inline AI suggestions for terminal sessions:
 *   - subscribes to ICommandBlockService.query$ for `# <query>` natural-language input
 *   - subscribes to ICommandBlockService.blockFinished$ for failed commands
 *   - calls the LLM via ILLMProviderService (bypass — no chat-history pollution)
 *   - injects the resulting command into the PTY/SSH stdin (single-line, with
 *     a `Ctrl+U` clear prefix; never appends `\r` so the user must confirm)
 */
export interface ITerminalSuggestService {
  /** Stream of every suggestion produced (for UI surfacing — toasts, logs). */
  readonly suggestion$: Observable<ITerminalSuggestion>;

  /**
   * Stream of suggestion lifecycle phase transitions (pending → cleared).
   * Emitted around each NL2Cmd / errorFix request so renderers can show
   * inline progress indicators. `cleared` is always emitted from a finally
   * block — including on abort, timeout, and session close.
   */
  readonly phase$: Observable<ITerminalSuggestionPhaseEvent>;

  /** Read the current resolved suggest config (synchronous, never throws). */
  getConfig(): ITerminalSuggestConfig;

  /**
   * Cancel any in-flight suggestion requests for the given session.
   * Aborts the underlying LLM stream and emits `phase: cleared`.
   * Safe to call when nothing is in flight (no-op).
   */
  cancelInflight(sessionId: string): void;

  /**
   * Apply the most recent error-fix suggestion for the given session.
   * Writes the stored command to the session's PTY (Ctrl+U + command,
   * with \n appended only for non-dangerous commands so dangerous ones
   * still require an explicit user Enter).
   *
   * Returns true if a suggestion was found and the write was issued;
   * false if there's no current suggestion for the session (caller can
   * surface a "nothing to apply" notice). Safe to call repeatedly —
   * applies the same suggestion until a fresh error-fix supersedes it.
   */
  applyLastErrorFix(sessionId: string): boolean;
}

export const ITerminalSuggestService = createIdentifier<ITerminalSuggestService>(
  'agent.terminal-suggest-service'
);
