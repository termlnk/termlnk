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
 * Origin of a terminal suggestion.
 *
 * - `nl2cmd`: user typed `# <query>` at the prompt; we generated a command.
 * - `errorFix`: a command exited non-zero; we generated a corrective command.
 */
export type TerminalSuggestionKind = 'nl2cmd' | 'errorFix';

/**
 * Lifecycle phase of an in-flight suggestion request, used to drive
 * renderer-side visual feedback (e.g. an inline spinner).
 *
 * - `pending`: request started; renderer should begin animating.
 * - `cleared`: request resolved (success / failure / aborted); renderer
 *   should stop animating and clean any drawn state. Always emitted from a
 *   `finally` block so the renderer never gets stuck spinning.
 */
export type TerminalSuggestionPhase = 'pending' | 'cleared';

export interface ITerminalSuggestionPhaseEvent {
  sessionId: string;
  kind: TerminalSuggestionKind;
  phase: TerminalSuggestionPhase;
  /**
   * Unique id matching a `pending` event with its eventual `cleared`. Lets
   * consumers track concurrent / superseded requests correctly: maintain a
   * Set of active requestIds and the spinner is on iff the Set is non-empty.
   * Without this, race scenarios (a prior request's finally firing after the
   * new request emitted pending) would prematurely stop the indicator.
   */
  requestId: string;
  /** Wall-clock timestamp of the phase transition (ms since epoch). */
  at: number;
}

/** Default natural-language query prefix character. */
export const DEFAULT_NL_PREFIX_CHAR = '#';

export interface ITerminalSuggestion {
  /** Stable id for this suggestion (per-session monotonic). */
  id: string;
  sessionId: string;
  kind: TerminalSuggestionKind;
  /** The command we plan to inject (single-line, sanitized — no embedded newlines). */
  command: string;
  /** One-sentence summary of what the command does (<= 72 chars). */
  summary: string;
  /** Whether the command matches a "dangerous" pattern (rm -rf, dd of=, etc.). */
  dangerous: boolean;
  /** Whether the suggestion was actually injected to the terminal stdin. */
  injected: boolean;
  /** Wall-clock timestamp when the suggestion was produced (ms since epoch). */
  createdAt: number;
}

/**
 * Configuration for the Termlnk inline suggestion feature.
 * Stored as a sub-key of `AGENT_PLUGIN_CONFIG_KEY.suggest`.
 */
export interface ITerminalSuggestConfig {
  /** Master switch. When false, the service is fully inert. */
  enabled: boolean;
  /**
   * Whether to intercept `# <query>` lines for natural-language to command.
   * Requires shell integration (zsh / fish only).
   */
  naturalLanguageEnabled: boolean;
  /**
   * Whether to automatically generate a fix suggestion when a command fails.
   * Works in bash / zsh / fish (any shell that emits OSC 633;D with a non-zero
   * exit code).
   */
  errorAutoSuggest: boolean;
  /**
   * Optional dedicated model id for suggestions, e.g. a faster/cheaper model
   * than the main chat model. Format: `<provider>/<modelId>`. When unset,
   * falls back to the active chat model.
   */
  suggestModelId?: string;
}

export const DEFAULT_TERMINAL_SUGGEST_CONFIG: ITerminalSuggestConfig = {
  enabled: true,
  naturalLanguageEnabled: true,
  errorAutoSuggest: true,
};
