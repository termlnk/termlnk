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
import { IAIAgentClientService } from '@termlnk/rpc-client';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Braille-pattern frames. Each frame is exactly one terminal cell wide in
 * every common monospace font, so the DECSC/DECRC trick stays accurate even
 * on fonts that render `✦`/`✶` as double-width.
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/** Frame interval — 80ms ≈ 12.5 fps, smooth without taxing the renderer. */
const FRAME_INTERVAL_MS = 80;

/**
 * Sequence written every frame:
 *   ESC 7                      save cursor (DECSC)
 *   CSI 38;5;244 m             dim grey foreground
 *   ` ` + frame                two cells: blank gap + brail glyph
 *   CSI 0 m                    reset SGR
 *   ESC 8                      restore cursor (DECRC)
 *
 * The blank gap visually separates the spinner from BUFFER text, and the
 * DECRC restore puts the xterm cursor back where it was so the shell's
 * (ZLE / readline / fish) idea of cursor position stays in sync.
 */
function buildFrameSequence(frame: string): string {
  return `\x1B7\x1B[38;5;244m ${frame}\x1B[0m\x1B8`;
}

/**
 * Sequence written once on `cleared` to overwrite the spinner cells with
 * blanks (handles the case where no shell repaint follows — e.g. LLM
 * declined to produce a command). When a real command does land via PTY
 * write, the shell repaints the prompt area anyway; this sequence is then
 * harmless.
 */
const CLEAR_SEQUENCE = '\x1B7  \x1B8';

export interface IUseSuggestionSpinnerOptions {
  sessionId: string;
  xtermRef: RefObject<Terminal | null>;
}

export interface IUseSuggestionSpinnerResult {
  /**
   * Call from the terminal view's `onData` (user keystroke) handler. While a
   * spinner is active, this aborts the underlying LLM request via tRPC and
   * stops the local animation; otherwise it is a no-op.
   *
   * Always pass user input through normally — this hook does not swallow it.
   */
  notifyUserInput: () => void;
}

/**
 * Renderer-side spinner driven by `IAIAgentClientService.terminalSuggestionPhase$`.
 *
 * - Subscribes filtered by sessionId; tracks active requestIds in a Set so
 *   superseded requests don't race-stop the indicator.
 * - Animates inline at the current xterm cursor position via DECSC/DECRC,
 *   so the shell's cursor model is undisturbed.
 * - Cleans up on unmount, on the last cleared event, and on session change.
 */
export function useSuggestionSpinner(options: IUseSuggestionSpinnerOptions): IUseSuggestionSpinnerResult {
  const { sessionId, xtermRef } = options;
  const aiAgentService = useDependency(IAIAgentClientService);

  // Active request ids. Spinner runs iff this set is non-empty. Stored in a
  // ref so the subscription handler and notifyUserInput observe the latest
  // value without triggering re-renders.
  const activeRef = useRef<Set<string>>(new Set());
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop spinner — central place so cleanup is consistent.
  const stopSpinner = useCallback((emitClear: boolean) => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (emitClear) {
      try {
        xtermRef.current?.write(CLEAR_SEQUENCE);
      } catch {
        // Terminal may already be disposed; ignore.
      }
    }
  }, [xtermRef]);

  const startSpinner = useCallback(() => {
    if (intervalIdRef.current !== null) {
      return;
    }
    let frameIdx = 0;
    intervalIdRef.current = setInterval(() => {
      const term = xtermRef.current;
      if (!term) {
        return;
      }
      const frame = SPINNER_FRAMES[frameIdx % SPINNER_FRAMES.length];
      frameIdx += 1;
      try {
        term.write(buildFrameSequence(frame));
      } catch {
        // Terminal may have been disposed mid-tick.
      }
    }, FRAME_INTERVAL_MS);
  }, [xtermRef]);

  // Subscribe to phase events. The Observable filters by sessionId here
  // rather than upstream so unrelated sessions' events get short-circuited
  // cheaply.
  useEffect(() => {
    const active = activeRef.current;
    const sub = aiAgentService.terminalSuggestionPhase$.subscribe((event) => {
      if (event.sessionId !== sessionId) {
        return;
      }
      const wasEmpty = active.size === 0;
      if (event.phase === 'pending') {
        active.add(event.requestId);
      } else {
        active.delete(event.requestId);
      }
      const isEmpty = active.size === 0;
      if (wasEmpty && !isEmpty) {
        startSpinner();
      } else if (!wasEmpty && isEmpty) {
        stopSpinner(true);
      }
    });
    return () => {
      sub.unsubscribe();
      // Component is going away — drop animation without writing the clear
      // sequence (xterm may already be disposed).
      stopSpinner(false);
      active.clear();
    };
  }, [aiAgentService, sessionId, startSpinner, stopSpinner]);

  const notifyUserInput = useCallback(() => {
    if (activeRef.current.size === 0) {
      return;
    }
    // Tell main process to abort. The handler's `finally` will emit
    // `cleared` for each requestId, so we don't manipulate `activeRef`
    // directly — we let the event stream drive state, keeping a single
    // source of truth.
    aiAgentService.cancelTerminalSuggestion(sessionId).catch(() => {
      // Best-effort cancel; UI continues to spin until cleared event arrives.
    });
  }, [aiAgentService, sessionId]);

  return { notifyUserInput };
}
