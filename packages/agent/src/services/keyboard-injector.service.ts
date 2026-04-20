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
import type { IExternalAgentSession } from '../models/agent-hook';
import { createIdentifier } from '@termlnk/core';

/**
 * Keyboard-injection service — the bridge between Dynamic Island picks
 * and the CLI TUI that the external agent is currently showing.
 *
 * The problem it solves: Claude Code's `AskUserQuestion` cannot be both
 * blocking (island answers, CLI TUI hidden) and fire-and-forget (CLI TUI
 * shown, island's answer has nowhere to go). Making the hook non-blocking
 * lets the CLI TUI render normally; when the user instead picks an option
 * in the island, this service synthesises the equivalent keystrokes into
 * the terminal app that owns the CLI's controlling tty — the TUI observes
 * the keys as if the user had typed them, and Claude Code completes the
 * tool call with the selected answer. Either end can drive the decision.
 *
 * Platform support: macOS only (CGEventPostToPid + Accessibility API).
 * On other platforms `supported` is false and `injectOption` always
 * returns false; callers fall back to the original blocking-hook flow.
 */
export interface IKeyboardInjectorService {
  /** True when the running platform has a working injection backend. */
  readonly supported: boolean;

  /** Live Accessibility-permission state (only meaningful on macOS). */
  readonly trusted$: Observable<boolean>;

  /**
   * Trigger the system Accessibility-permission prompt (once per user),
   * then re-check. Resolves with the post-prompt trusted state. No-op
   * on platforms where {@link supported} is false.
   */
  requestPermission(): Promise<boolean>;

  /**
   * Synthesise the keystrokes needed to select option `optionIndex`
   * (0-based, cursor assumed on the first option) into the terminal app
   * that owns `session.externalMeta.tty`.
   *
   * Returns true only when every step succeeded: platform supported,
   * Accessibility granted, tty resolved to a known app, and every key
   * token posted. Any failure returns false — the caller should keep
   * the pending island state and let the user respond in the CLI TUI.
   */
  injectOption(session: IExternalAgentSession, optionIndex: number): Promise<boolean>;
}

export const IKeyboardInjectorService = createIdentifier<IKeyboardInjectorService>(
  'agent.keyboard-injector-service'
);
