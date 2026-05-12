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

// Mobile shell resumption strategy: when iOS backgrounds the app for >30s the TCP
// SSH channel goes away, but the user's shell state should not. tmux / screen on the
// remote side keeps a detached session alive across reconnects.
//
// On every SSH shell start we run an idempotent command that:
//   1. Detects tmux availability — `command -v tmux` exits 0 when found.
//   2. `tmux new-session -A -s NAME` attaches if the named session exists, else creates
//      it. The `-A` flag is what gives us the "resume where I left off" UX.
//   3. Falls back to `screen -RR NAME` (reattach, reconnect detached).
//   4. Final fallback: plain login shell. We do NOT print a warning here — the user can
//      see in the UI whether `IShellResumptionState.kind === 'plain'`.
//
// Why not `exec tmux ...`: replacing the SSH shell process means SSH session dies the
// moment the user detaches tmux. Running tmux as a child preserves the SSH channel as
// a thin wrapper around the tmux client; exit drops back to bash, then SSH closes
// cleanly.

export interface IShellResumptionOptions {
  readonly hostId: string;
}

export interface IShellResumptionCommand {
  // Bash one-liner written to the SSH shell after startShell(). Ends with a newline
  // so the remote shell executes it immediately.
  readonly command: string;
  // Stable identifier used in tmux/screen session name. ≤32 chars, alphanumeric +
  // dash; derived from hostId so reconnects target the same session.
  readonly sessionName: string;
}

const MAX_SESSION_NAME_LEN = 32;

function sanitizeSessionName(hostId: string): string {
  const cleaned = hostId.replace(/[^a-zA-Z0-9-]/g, '-');
  const trimmed = cleaned.slice(0, MAX_SESSION_NAME_LEN - 'termlnk-'.length);
  return `termlnk-${trimmed}`;
}

export function buildShellResumptionCommand(options: IShellResumptionOptions): IShellResumptionCommand {
  const sessionName = sanitizeSessionName(options.hostId);
  // Single bash line so the remote shell's prompt does not interleave. `2>/dev/null`
  // on the probes keeps non-existent-binary stderr out of the user's pane. `exec` on
  // the final $SHELL is the no-resume fallback — replaces the bash process so detaching
  // is a clean SSH exit instead of a nested shell.
  const command = [
    `if command -v tmux >/dev/null 2>&1; then`,
    `  tmux new-session -A -s ${sessionName};`,
    `elif command -v screen >/dev/null 2>&1; then`,
    `  screen -RR ${sessionName};`,
    `else`,
    `  echo "termlnk: tmux/screen not found; running plain shell";`,
    `fi`,
    '',
  ].join('\n');
  return { command, sessionName };
}

// Result of a remote probe — populated by the UI after observing the first shell
// output. P6.4 ships the *command* and a name; classifying the actual remote state
// (which binary won) is best done by parsing PS1 / the user's prompt later, since the
// SSH lib only surfaces stdout chunks.
export type ShellResumptionKind = 'tmux' | 'screen' | 'plain';

export interface IShellResumptionState {
  readonly kind: ShellResumptionKind;
  readonly sessionName: string;
}
