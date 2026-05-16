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

// Mobile shell resumption. iOS backgrounds drop the SSH channel after ~30s, so we wrap
// the remote shell in `tmux new-session -A` (with `screen -RR` fallback) to keep the
// user's shell state alive across reconnects. We deliberately run tmux as a child, not
// via `exec`: replacing the SSH shell would let detach kill the SSH session, while a
// child wrapper lets detach return to bash and exit cleanly.

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
    'if command -v tmux >/dev/null 2>&1; then',
    `  tmux new-session -A -s ${sessionName};`,
    'elif command -v screen >/dev/null 2>&1; then',
    `  screen -RR ${sessionName};`,
    'else',
    '  echo "termlnk: tmux/screen not found; running plain shell";',
    'fi',
    '',
  ].join('\n');
  return { command, sessionName };
}

// Result of the remote probe — populated by the UI after observing the first shell
// output. Classifying which binary actually attached requires parsing PS1; this layer
// only emits the command + name.
export type ShellResumptionKind = 'tmux' | 'screen' | 'plain';

export interface IShellResumptionState {
  readonly kind: ShellResumptionKind;
  readonly sessionName: string;
}
