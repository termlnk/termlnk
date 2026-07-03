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

import type { Terminal } from '@xterm/xterm';
import type { RefObject } from 'react';
import { useDependency } from '@termlnk/design';
import { IAIAgentMessagingService } from '@termlnk/rpc-client';
import { useEffect } from 'react';

/**
 * Render an error-fix notice card directly into the xterm grid when the
 * service emits a non-injected `errorFix` suggestion. The card mirrors
 * Kaku's `╭─ … ╰─ <command>    Cmd+Shift+E` two-line frame.
 *
 * The card is written between the failed command's prompt line and a fresh
 * prompt that the main process forces (via a single `\n` to PTY) right
 * after this event. Because `terminalSuggestion$` and the PTY data stream
 * share the same IPC FIFO, the card lands first and the new prompt arrives
 * below it.
 */
const ACCENT_COLOR = '\x1B[38;5;105m'; // soft purple, similar to Kaku's dark-mode accent
const HINT_COLOR = '\x1B[38;5;249m'; // dim grey for the shortcut hint
const DANGER_COLOR = '\x1B[38;5;203m'; // soft red for the dangerous-command badge
const RESET = '\x1B[0m';
const BOLD = '\x1B[1m';

const SHORTCUT_LABEL_MAC = 'Cmd+Shift+E';
const SHORTCUT_LABEL_OTHER = 'Ctrl+Shift+E';

function shortcutLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)) {
    return SHORTCUT_LABEL_MAC;
  }
  return SHORTCUT_LABEL_OTHER;
}

function buildNotice(summary: string, command: string, dangerous: boolean): string {
  const safeSummary = (summary || 'Suggested fix').slice(0, 200);
  const top = `${ACCENT_COLOR}╭─ Termlnk AI${RESET}  ${BOLD}${safeSummary}${RESET}`;
  const dangerBadge = dangerous
    ? ` ${DANGER_COLOR}⚠ dangerous — review before running${RESET}`
    : '';
  const bottom = command
    ? `${ACCENT_COLOR}╰─${RESET} ${command}    ${HINT_COLOR}${shortcutLabel()}${RESET}${dangerBadge}`
    : `${ACCENT_COLOR}╰─${RESET} ${HINT_COLOR}No safe command suggested${RESET}`;
  // Leading \r\n moves cursor below the (now-abandoned) prompt that was
  // showing when we got the event. Trailing \r\n leaves the cursor at
  // column 0 so the new prompt forced by main lands on a clean line.
  return `\r\n${top}\r\n${bottom}\r\n`;
}

export interface IUseErrorFixNoticeOptions {
  sessionId: string;
  xtermRef: RefObject<Terminal | null>;
}

export function useErrorFixNotice(options: IUseErrorFixNoticeOptions): void {
  const { sessionId, xtermRef } = options;
  const aiAgentService = useDependency(IAIAgentMessagingService);

  useEffect(() => {
    const sub = aiAgentService.terminalSuggestion$.subscribe((suggestion) => {
      if (suggestion.sessionId !== sessionId) {
        return;
      }
      // We only paint the inline notice for non-injected error-fix
      // suggestions. NL2Cmd lands directly on the prompt via PTY write, and
      // an applied error-fix would also have `injected: true`.
      if (suggestion.kind !== 'errorFix' || suggestion.injected) {
        return;
      }
      const term = xtermRef.current;
      if (!term) {
        return;
      }
      try {
        term.write(buildNotice(suggestion.summary, suggestion.command, suggestion.dangerous));
      } catch {
        // Terminal disposed mid-event — drop silently.
      }
    });
    return () => sub.unsubscribe();
  }, [aiAgentService, sessionId, xtermRef]);
}
